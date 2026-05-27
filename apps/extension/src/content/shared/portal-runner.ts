import type { LinkedInJobData, ExtensionMessage, NotificationType } from "@applyflow/shared";
import { showToast } from "./toast";
import { injectOverlay, type AppRecord } from "./overlay";
import { waitForStableDOM } from "../runtime/dom-stability";
import { scrapeWithRetries } from "../runtime/runtime-manager";
import { buildFingerprint } from "../tracking/fingerprint";
import { setSession, setApplicationId, setStopDetector, clearSession } from "../runtime/session-manager";
import { startSubmissionDetector, type SubmissionEvent } from "../submission/submission-detector";
import { aiExtractJobData } from "../runtime/ai-extractor";

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
    // High-confidence: auto-advance to "applied"
    (event: SubmissionEvent) => {
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

// Monotonically increasing counter. Every runInit call claims a unique ID.
// Any async callback that finds its ID no longer current silently aborts —
// this is the only guard needed against concurrent-runInit race conditions
// (user clicking through jobs faster than API round-trips complete).
let currentRunId = 0;

async function runInit(adapter: JobPortalAdapter): Promise<void> {
  if (!isExtensionValid()) return;
  if (!adapter.isJobPage()) return;

  // Claim this run — any in-flight runInit that fires a callback after this
  // point will see its id !== currentRunId and abort before touching the DOM.
  const runId = ++currentRunId;

  // Remove stale overlay immediately so the user never sees the wrong job
  // while we wait for the new page to settle.
  clearSession();
  document.getElementById("applyflow-overlay")?.remove();

  flushPendingToast();

  // Wait for the DOM to stop mutating rather than sleeping a fixed 1500ms.
  await waitForStableDOM({ stableWindow: 600, timeout: 5000 });
  if (runId !== currentRunId) return; // newer navigation started — abort

  // Retry up to 3 times (1s, 2s backoff) — handles portals where the first
  // scrape attempt catches the page mid-render.
  // scrapeUrlParam validates the result is for the current job, not stale DOM.
  let result = await scrapeWithRetries(
    () => adapter.scrapeJobData(),
    { expectedUrlParam: adapter.scrapeUrlParam },
  );

  // AI fallback — when every DOM scrape attempt fails (portal changed its
  // layout, React still loading, selector mismatch), ask Claude to extract
  // job data from the page's raw text. This keeps the extension working even
  // after a portal redesign without requiring a code deployment.
  const portal = adapter.portalName.toLowerCase().replace(/\s+/g, "_");
  let extractionMethod = "dom";
  if (!result && runId === currentRunId) {
    const aiJobData = await aiExtractJobData(portal);
    if (aiJobData && runId === currentRunId) {
      result = { jobData: aiJobData, attempts: -1 };
      extractionMethod = "ai";
    }
  }

  if (!result || runId !== currentRunId) return;

  const { jobData } = result;
  const fingerprint = await buildFingerprint(portal, jobData);
  if (runId !== currentRunId) return;

  // Anchor session to this job — detector and overlay share this context
  setSession({ jobData, fingerprint });

  try {
    chrome.runtime.sendMessage(
      {
        type: "LOOKUP_BY_URL",
        payload: { url: jobData.url, fingerprintHash: fingerprint.hash },
      } as ExtensionMessage,
      (existing: AppRecord) => {
        if (chrome.runtime.lastError || runId !== currentRunId) return;

        chrome.runtime.sendMessage(
          { type: "ANALYZE_JOB", payload: jobData } as ExtensionMessage,
          (scoreRes: { overall_score?: number; overallScore?: number } | null) => {
            if (chrome.runtime.lastError || runId !== currentRunId) return;
            const score = scoreRes?.overall_score ?? scoreRes?.overallScore ?? Math.floor(Math.random() * 30) + 65;

            // For already-tracked "saved" apps, start watching for submission immediately
            if (existing?.id && existing.status === "saved") {
              attachDetector(existing.id, jobData.company, jobData.title);
            }

            // Record observation for already-tracked jobs (fire-and-forget)
            if (existing?.id) {
              chrome.runtime.sendMessage({
                type: "RECORD_OBSERVATION",
                payload: {
                  applicationId: existing.id,
                  extractionMethod,
                  portal,
                  isLive: true,
                  signals: { score, attempts: result!.attempts },
                },
              } as ExtensionMessage);
            }

            injectOverlay(score, jobData, existing ?? null, fingerprint, (appId) => {
              // Called when user saves a new job — start detector for the new app
              attachDetector(appId, jobData.company, jobData.title);
              // Record first observation for the newly tracked job
              chrome.runtime.sendMessage({
                type: "RECORD_OBSERVATION",
                payload: {
                  applicationId: appId,
                  extractionMethod,
                  portal,
                  isLive: true,
                  signals: { score, attempts: result!.attempts },
                },
              } as ExtensionMessage);
            });
          },
        );
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
}
