/**
 * Apply button interceptor — observational only.
 *
 * Watches for clicks on Apply/Easy Apply buttons on job listing pages.
 * When detected, writes an ApplySession to chrome.storage.session BEFORE
 * the navigation event fires, so the destination ATS page can pick it up.
 *
 * CRITICAL REQUIREMENTS:
 * - MUST NOT block navigation
 * - MUST NOT hijack or prevent click events
 * - MUST NOT interfere with portal behavior in any way
 * - This is purely observational — it only reads DOM state and writes storage
 */

import { createApplySession, updateApplySession } from "./application-session";
import { track } from "../telemetry/tracker";
import type { JobFingerprint } from "../tracking/fingerprint";

// Text patterns that reliably indicate an Apply action.
// Anchored to full button text (after trim) to avoid false matches.
const APPLY_TEXT_RE =
  /^(easy\s+apply|apply\s+now|apply\s+on\s+\S+|apply\s+with\s+\S+|apply\s+to\s+\S+|continue\s+application|external\s+apply|submit\s+application|apply)$/i;

// Additional aria-label / title patterns for icon-only buttons
const APPLY_ARIA_RE = /apply|submit.{0,20}application/i;

export type InterceptorOptions = {
  fingerprint: JobFingerprint;
  applicationId: string;
  tailoredResumeId?: string | null;
  sourcePortal: string;
  company?: string;
  role?: string;
};

async function requestDynamicApplyPermission(): Promise<void> {
  try {
    if (!chrome.permissions) return;
    const hasPermission = await chrome.permissions.contains({ origins: ["<all_urls>"] });
    if (!hasPermission) {
      await chrome.permissions.request({ origins: ["<all_urls>"] });
    }
  } catch {
    // Optional permission is best-effort. Known static hosts and manual autofill
    // remain unchanged when the user denies or Chrome blocks the request.
  }
}

function isApplyLike(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role") ?? "";
  const isInteractive = tag === "button" || tag === "a" || role === "button" || role === "link";
  if (!isInteractive) return false;

  const text = (el.textContent ?? "").trim();
  if (APPLY_TEXT_RE.test(text)) return true;

  const aria = el.getAttribute("aria-label") ?? "";
  const title = el.getAttribute("title") ?? "";
  if (APPLY_ARIA_RE.test(aria) || APPLY_ARIA_RE.test(title)) return true;

  return false;
}

function findApplyAncestor(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  let el: Element | null = target;
  // Walk up to 5 levels — buttons sometimes have nested spans/icons
  for (let i = 0; i < 5; i++) {
    if (!el) break;
    if (isApplyLike(el)) return el as HTMLElement;
    el = el.parentElement;
  }
  return null;
}

/**
 * Start observing Apply button clicks on the current page.
 * Returns a cleanup function that removes the listener.
 */
export function startApplyInterceptor(options: InterceptorOptions): () => void {
  const { fingerprint, applicationId, tailoredResumeId, sourcePortal, company, role } = options;
  let lastPersistedAt = 0;

  const persistSession = () => {
    const now = Date.now();
    if (now - lastPersistedAt < 750) return;
    lastPersistedAt = now;

    // Fire-and-forget: write session to storage before navigation starts.
    // We intentionally avoid a read-before-write here. A fast external redirect
    // can win the race if we first await getApplySession(); overwriting the same
    // job session is safe and keeps the legacy click behavior untouched.
    void (async () => {
      try {
        const session = await createApplySession({
          applicationId,
          fingerprintHash: fingerprint.hash,
          sourcePortal,
          tailoredResumeId: tailoredResumeId ?? undefined,
          company,
          role,
        });

        chrome.runtime.sendMessage({
          type: "APPLY_SESSION_STARTED",
          payload: { sessionId: session?.sessionId },
        });

        // Hybrid mode: known ATS hosts still use manifest-declared content
        // scripts. Unknown/custom ATS hosts need optional <all_urls> permission,
        // requested only from this user apply gesture.
        void requestDynamicApplyPermission();
        chrome.runtime.sendMessage({
          type: "ENSURE_DYNAMIC_APPLY_PERMISSION",
          payload: { reason: "external_apply" },
        });

        track("apply_session_created", {
          portal: sourcePortal,
          applicationId,
          hasResume: !!tailoredResumeId,
        });
      } catch {
        // Never throw — this function is purely observational
      }
    })();
  };

  const handlePointerIntent = (e: MouseEvent | PointerEvent) => {
    if (!findApplyAncestor(e.target)) return;
    persistSession();
  };

  const handleClick = (e: MouseEvent) => {
    if (!findApplyAncestor(e.target)) return;
    persistSession();
    // Keep a redirecting marker for same-page Apply modals and SPA flows. This
    // update is deliberately secondary; session creation above is the critical
    // cross-page persistence path.
    void updateApplySession({
      currentState: "redirecting",
      currentUrl: window.location.href,
    });
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (!findApplyAncestor(e.target)) return;
    persistSession();
  };

  // Capture phase so we hear clicks before portal JS can stop propagation
  document.addEventListener("pointerdown", handlePointerIntent, { capture: true, passive: true });
  document.addEventListener("mousedown", handlePointerIntent, { capture: true, passive: true });
  document.addEventListener("click", handleClick, { capture: true, passive: true });
  document.addEventListener("keydown", handleKeydown, { capture: true });
  return () => {
    document.removeEventListener("pointerdown", handlePointerIntent, { capture: true });
    document.removeEventListener("mousedown", handlePointerIntent, { capture: true });
    document.removeEventListener("click", handleClick, { capture: true });
    document.removeEventListener("keydown", handleKeydown, { capture: true });
  };
}
