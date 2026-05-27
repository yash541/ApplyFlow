/**
 * Watches URL changes and DOM mutations for signals that an application was
 * successfully submitted — thank-you pages, confirmation banners, success text.
 */

export type SuccessSignal = {
  kind: "url_pattern" | "dom_element" | "dom_text";
  detail: string;
  confidence: number;
};

// ── Signal patterns ───────────────────────────────────────────────────────────

const SUCCESS_URL_RE = new RegExp(
  [
    "application[-_]?submitted",
    "apply[-_]?confirm",
    "application[-_]?complete",
    "\\/thank[-_]?you",
    "applicationSubmitted=true",
    "\\/success\\b",
    "\\/confirmation\\b",
    "applied=true",
  ].join("|"),
  "i",
);

// Stable data-* / aria attributes unlikely to be false-positives
const SUCCESS_SELECTORS = [
  '[data-test*="application-submitted" i]',
  '[data-test*="apply-success" i]',
  '[data-test*="confirmation" i]',
  '[data-automation*="confirmation" i]',
  '[aria-label*="application submitted" i]',
  '[class*="ApplicationConfirmation"]',
  '[class*="apply-confirmation"]',
  '[class*="submission-success"]',
];

const SUCCESS_TEXT_RE = new RegExp(
  [
    "your application (has been |was )?submitted",
    "application submitted",
    "successfully applied",
    "we received your application",
    "thanks for applying",
    "application complete",
    "thank you for applying",
    "application was sent",
  ].join("|"),
  "i",
);

// ── Checks ────────────────────────────────────────────────────────────────────

function checkUrl(): SuccessSignal | null {
  if (SUCCESS_URL_RE.test(location.href)) {
    return { kind: "url_pattern", detail: location.href, confidence: 0.8 };
  }
  return null;
}

function checkDom(): SuccessSignal | null {
  for (const sel of SUCCESS_SELECTORS) {
    if (document.querySelector(sel)) {
      return { kind: "dom_element", detail: sel, confidence: 0.75 };
    }
  }
  const bodyText = document.body?.innerText ?? "";
  if (SUCCESS_TEXT_RE.test(bodyText)) {
    return { kind: "dom_text", detail: bodyText.slice(0, 120), confidence: 0.75 };
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startSuccessDetector(
  onSignal: (signal: SuccessSignal) => void,
): () => void {
  let stopped = false;

  function emit(sig: SuccessSignal | null) {
    if (sig && !stopped) onSignal(sig);
  }

  // Check immediately in case we landed on a confirmation page
  emit(checkUrl() ?? checkDom());

  // Watch URL changes (SPA navigations)
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (stopped || location.href === lastUrl) return;
    lastUrl = location.href;
    emit(checkUrl());
  });
  urlObserver.observe(document, { subtree: true, childList: true });

  // Watch DOM for dynamically rendered confirmation elements
  let domTimer: ReturnType<typeof setTimeout> | null = null;
  const domObserver = new MutationObserver(() => {
    if (stopped) return;
    if (domTimer) clearTimeout(domTimer);
    domTimer = setTimeout(() => emit(checkDom()), 400);
  });
  domObserver.observe(document.body ?? document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
  });

  return () => {
    stopped = true;
    urlObserver.disconnect();
    domObserver.disconnect();
    if (domTimer) clearTimeout(domTimer);
  };
}
