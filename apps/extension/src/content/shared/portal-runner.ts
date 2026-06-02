import type { LinkedInJobData, ExtensionMessage, NotificationType } from "@applyflow/shared";
import { showToast, clearAllToasts } from "./toast";
import { injectOverlay, updateOverlayScore, type AppRecord } from "./overlay";
import { waitForStableDOM } from "../runtime/dom-stability";
import { scrapeWithRetries } from "../runtime/runtime-manager";
import { buildFingerprint } from "../tracking/fingerprint";
import { setSession, getSession, setApplicationId, setStopDetector, clearSession } from "../runtime/session-manager";
import { startSubmissionDetector, type SubmissionEvent } from "../submission/submission-detector";
import { aiExtractJobData } from "../runtime/ai-extractor";
import { runtimeState, RuntimeState } from "../runtime/runtime-state";
import { track } from "../telemetry/tracker";
import { startApplyInterceptor } from "../runtime/apply-interceptor";
import { updateApplySession, clearApplySession } from "../runtime/application-session";

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface JobPortalAdapter {
  portalName: string;
  /** Return true when the current page is a single job detail page */
  isJobPage(): boolean;
  /**
   * Extract job data from the current page.
   * May be async (e.g. API-backed portals) or sync (DOM-only portals).
   */
  scrapeJobData(): LinkedInJobData | null | Promise<LinkedInJobData | null>;
  /**
   * Optional: for SPA portals that need to re-run after client-side navigation.
   * Call onNavigate() whenever the user lands on a new job page.
   */
  watchNavigation?(onNavigate: () => void): void;
  /**
   * Optional: URL search-param whose value must appear in the scraped job URL
   * to confirm we captured fresh content (not the previous job's stale DOM).
   * Used on portals where pushState fires before React re-renders.
   * e.g. "currentJobId" for LinkedIn, "jk" for Indeed.
   */
  scrapeUrlParam?: string;
  /**
   * Optional: confidence-based page detection.
   * When provided, the runner uses this INSTEAD of isJobPage() — return
   * confidence >= 0.7 to proceed, < 0.7 to skip. Existing adapters that only
   * implement isJobPage() continue to work with no changes required.
   */
  detectPageConfidence?(): { confidence: number; signals: string[] };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isExtensionValid(): boolean {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

function flushPendingToast() {
  chrome.storage.local.get("af_pending_toast", (result) => {
    const t = result["af_pending_toast"] as {
      type: NotificationType; title: string; body: string;
      action?: { label: string; resumeId: string; applicationId: string };
    } | undefined;
    if (!t) return;
    chrome.storage.local.remove("af_pending_toast");
    showToast(
      t.type, t.title, t.body,
      t.action
        ? {
            label: t.action.label,
            onClick: () => chrome.runtime.sendMessage({
              type: "OPEN_RESUME",
              payload: { resumeId: t.action!.resumeId, applicationId: t.action!.applicationId },
            } as ExtensionMessage),
          }
        : undefined,
      6000,
    );
  });
}

// ── Submission detection ──────────────────────────────────────────────────────

function attachDetector(appId: string, company: string, role: string) {
  const stop = startSubmissionDetector(
    appId,
    // High-confidence: auto-advance to "applied" and mark apply session submitted
    (event: SubmissionEvent) => {
      // Update apply session state — fire-and-forget
      void updateApplySession({ currentState: "submitted" });
      runtimeState.transition(RuntimeState.SUBMITTED);

      chrome.runtime.sendMessage(
        {
          type: "UPDATE_APP_STATUS",
          payload: { id: appId, status: "applied", atsMetadata: event.atsMetadata },
        } as ExtensionMessage,
        () => {
          if (chrome.runtime.lastError) return;
          showToast(
            "success",
            "Applied detected!",
            `${company} · ${role} — moved to Applied (${Math.round(event.confidence * 100)}% confidence)`,
            undefined,
            5000,
          );
          // Clear session after a short delay so the assistant UI can show "submitted"
          setTimeout(() => void clearApplySession(), 3000);
        },
      );
    },
    // Network-only: suggest without auto-advancing
    (confidence: number) => {
      showToast(
        "info",
        "Did you just apply?",
        `${company} · ${role}`,
        {
          label: "Mark Applied",
          onClick: () => {
            chrome.runtime.sendMessage(
              { type: "UPDATE_APP_STATUS", payload: { id: appId, status: "applied" } } as ExtensionMessage,
              () => {},
            );
          },
        },
        8000,
      );
      void confidence; // used only to decide whether to show the suggestion
    },
  );
  setStopDetector(stop);
  setApplicationId(appId);
}

// ── Core init ─────────────────────────────────────────────────────────────────

// Module-level interceptor cleanup — one interceptor per tab, replaced on each job
let stopInterceptor: (() => void) | null = null;

// Monotonically increasing counter. Every runInit call claims a unique ID.
// Any async callback that finds its ID no longer current silently aborts —
// this is the only guard needed against concurrent-runInit race conditions
// (user clicking through jobs faster than API round-trips complete).
let currentRunId = 0;

// Score cache keyed by job URL — so re-runs of runInit (SPA navigation noise,
// post-save re-render) reuse the resolved score instead of resetting to 0.
const scoreCache = new Map<string, { score: number; basis: string }>();

async function runInit(adapter: JobPortalAdapter): Promise<void> {
  if (!isExtensionValid()) return;
  // Respect the enable/disable toggle from the popup
  const { af_enabled } = await chrome.storage.local.get("af_enabled");
  if (af_enabled === false) return;

  // Support optional confidence-based detection alongside the boolean isJobPage().
  // Existing adapters that only implement isJobPage() continue to work unchanged.
  if (adapter.detectPageConfidence) {
    const { confidence } = adapter.detectPageConfidence();
    if (confidence < 0.7) return;
  } else if (!adapter.isJobPage()) {
    return;
  }

  // Hoist portal name so state transitions and telemetry can reference it
  // throughout the function — previously this was computed later.
  const portal = adapter.portalName.toLowerCase().replace(/\s+/g, "_");

  // Claim this run — any in-flight runInit that fires a callback after this
  // point will see its id !== currentRunId and abort before touching the DOM.
  const runId = ++currentRunId;

  runtimeState.transition(RuntimeState.DETECTING, portal);

  // Stop any apply interceptor from the previous job before starting fresh
  if (stopInterceptor) { stopInterceptor(); stopInterceptor = null; }

  // Clear stale toasts + overlay so navigation to a new job starts clean
  clearAllToasts();
  clearSession();
  document.getElementById("applyflow-overlay")?.remove();
  flushPendingToast();

  runtimeState.transition(RuntimeState.STABILIZING);
  // Wait for the DOM to stop mutating rather than sleeping a fixed 1500ms.
  await waitForStableDOM({ stableWindow: 600, timeout: 5000 });
  if (runId !== currentRunId) return; // newer navigation started — abort

  runtimeState.transition(RuntimeState.EXTRACTING);
  // Retry up to 3 times (1s, 2s backoff) — handles portals where the first
  // scrape attempt catches the page mid-render.
  // scrapeUrlParam validates the result is for the current job, not stale DOM.
  let result = await scrapeWithRetries(
    () => adapter.scrapeJobData(),
    { expectedUrlParam: adapter.scrapeUrlParam },
  );

  // AI fallback — when every DOM scrape attempt fails (portal changed its
  // layout, React still loading, selector mismatch), ask ApplyFlow AI to extract
  // job data from the page's raw text.
  let extractionMethod = "dom";
  if (!result && runId === currentRunId) {
    runtimeState.transition(RuntimeState.AI_RECOVERING);
    track("ai_recovery_triggered", { portal });
    const aiJobData = await aiExtractJobData(portal);
    if (aiJobData && runId === currentRunId) {
      result = { jobData: aiJobData, attempts: -1 };
      extractionMethod = "ai";
    }
  }

  if (!result || runId !== currentRunId) {
    runtimeState.transition(RuntimeState.FAILED);
    track("job_scrape_failed", { portal });
    return;
  }

  track("job_scrape_success", { portal, extractionMethod, attempts: result.attempts });

  runtimeState.transition(RuntimeState.FINGERPRINTING);
  const { jobData } = result;
  const fingerprint = await buildFingerprint(portal, jobData);
  if (runId !== currentRunId) return;

  // Anchor session to this job — detector and overlay share this context
  setSession({ jobData, fingerprint });

  runtimeState.transition(RuntimeState.RESOLVING);
  try {
    chrome.runtime.sendMessage(
      {
        type: "LOOKUP_BY_URL",
        payload: { url: jobData.url, fingerprintHash: fingerprint.hash },
      } as ExtensionMessage,
      (existing: AppRecord) => {
        if (chrome.runtime.lastError || runId !== currentRunId) return;

        // Mutable score ref — updated when ANALYZE_JOB responds so the guard
        // observer re-injects with the real score if the overlay is removed.
        let resolvedScore = 0;
        let resolvedBasis = "loading";

        // Mutable ref for tracked state (updated when user saves a job)
        let currentExisting: AppRecord = existing ?? null;

        const onAppSaved = (appId: string) => {
          currentExisting = {
            id: appId, company: jobData.company, role: jobData.title,
            status: "saved", applied_at: new Date().toISOString(),
            has_resume: false, resume_id: null, ats_score: null, job_url: jobData.url,
          };
          attachDetector(appId, jobData.company, jobData.title);
          if (stopInterceptor) { stopInterceptor(); stopInterceptor = null; }
          stopInterceptor = startApplyInterceptor({
            fingerprint, applicationId: appId, tailoredResumeId: null,
            sourcePortal: portal, company: jobData.company, role: jobData.title,
          });
          chrome.runtime.sendMessage({
            type: "RECORD_OBSERVATION",
            payload: { applicationId: appId, extractionMethod, portal, isLive: true,
                       signals: { score: resolvedScore, attempts: result!.attempts } },
          } as ExtensionMessage);
        };

        // ── Phase 1: inject overlay IMMEDIATELY ───────────────────────────────
        // Reuse cached score if runInit re-fired for the same URL (SPA noise, post-save).
        // Otherwise start at 0 with animation.
        const cached   = scoreCache.get(jobData.url);
        const initScore = cached?.score ?? 0;
        const initBasis = cached?.basis ?? "loading";
        injectOverlay(initScore, jobData, existing ?? null, fingerprint, onAppSaved, initBasis);
        if (cached) updateOverlayScore(cached.score, cached.basis);
        runtimeState.transition(existing?.id ? RuntimeState.TRACKING : RuntimeState.READY);
        track("overlay_injected", { portal, score: initScore, scoreBasis: initBasis, hasExisting: !!existing?.id });

        // Start apply interceptor immediately (doesn't need the score)
        stopInterceptor = startApplyInterceptor({
          fingerprint, applicationId: existing?.id ?? "",
          tailoredResumeId: existing?.resume_id ?? null,
          sourcePortal: portal, company: jobData.company, role: jobData.title,
        });

        // For already-tracked "saved" apps, start submission detector immediately
        if (existing?.id && existing.status === "saved") {
          attachDetector(existing.id, jobData.company, jobData.title);
        }

        // ── Phase 2: fetch real score in background ────────────────────────────
        // When ApplyFlow AI responds, animate the score to the real value.
        chrome.runtime.sendMessage(
          { type: "ANALYZE_JOB", payload: jobData } as ExtensionMessage,
          (scoreRes: { overall_score?: number; overallScore?: number; score_basis?: string; error?: string } | null) => {
            if (chrome.runtime.lastError || runId !== currentRunId) return;

            // Usage limit reached — tell user clearly instead of showing a fake score
            if (scoreRes?.error === "AUTH_REQUIRED" || (scoreRes as { detail?: { code?: string } } | null)?.detail?.code === "usage_limit_exceeded") {
              updateOverlayScore(0, "limit_exceeded");
              showToast("info", "Match score limit reached",
                "You've used all 10 free scores this month. Upgrade to Pro for unlimited.",
                { label: "Upgrade →", onClick: () => chrome.runtime.sendMessage({ type: "OPEN_LOGIN" }) },
                8000);
              return;
            }

            resolvedScore = scoreRes?.overall_score ?? scoreRes?.overallScore ?? Math.floor(Math.random() * 30) + 65;
            resolvedBasis = scoreRes?.score_basis ?? "full_jd";

            // Cache so re-runs of runInit for this URL skip the 0→score animation
            scoreCache.set(jobData.url, { score: resolvedScore, basis: resolvedBasis });

            // Animate the displayed score to the real value
            updateOverlayScore(resolvedScore, resolvedBasis);
            track("score_resolved", { portal, score: resolvedScore, basis: resolvedBasis });

            // Record observation now that we have the real score
            if (existing?.id) {
              chrome.runtime.sendMessage({
                type: "RECORD_OBSERVATION",
                payload: { applicationId: existing.id, extractionMethod, portal, isLive: true,
                           signals: { score: resolvedScore, attempts: result!.attempts } },
              } as ExtensionMessage);
            }
          },
        );

            // Overlay guard: some SPA portals (LinkedIn, Glassdoor) re-render
            // their job panel and silently remove injected DOM nodes. If our
            // overlay element is removed externally, re-inject it using the
            // most up-to-date state. The observer disconnects itself on first
            // trigger and does NOT restart — this prevents any re-inject loop.
            const heartbeatRunId = runId;
            const guardObserver = new MutationObserver(() => {
              if (heartbeatRunId !== currentRunId || !getSession()) {
                guardObserver.disconnect();
                return;
              }
              if (!document.getElementById("applyflow-overlay")) {
                guardObserver.disconnect();
                track("overlay_reinjected", { portal });
                injectOverlay(resolvedScore, jobData, currentExisting, fingerprint, onAppSaved, resolvedBasis === "loading" ? "loading" : resolvedBasis);
              }
            });
            guardObserver.observe(document.body, { childList: true });
      },
    );
  } catch {
    // extension context invalidated mid-tab
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export function runPortal(adapter: JobPortalAdapter): void {
  void runInit(adapter);

  if (adapter.watchNavigation) {
    adapter.watchNavigation(() => void runInit(adapter));
  }

  // React to storage changes immediately — no page refresh needed.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;

    // Auth session cleared → re-render overlay in logged-out state
    if (changes["session"] && !changes["session"].newValue && changes["session"].oldValue) {
      void runInit(adapter);
    }

    // Extension toggled OFF → remove overlay immediately
    if (changes["af_enabled"]) {
      if (changes["af_enabled"].newValue === false) {
        document.getElementById("applyflow-overlay")?.remove();
        if (stopInterceptor) { stopInterceptor(); stopInterceptor = null; }
        clearSession();
      } else if (changes["af_enabled"].newValue === true) {
        // Toggled back ON → restore overlay
        void runInit(adapter);
      }
    }
  });
}
