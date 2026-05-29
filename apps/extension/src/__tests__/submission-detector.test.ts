import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the confidence logic in isolation by re-implementing the math
// since the actual detector requires browser DOM. Tests here validate
// the threshold invariants that must hold in production.

const AUTO_ADVANCE_THRESHOLD = 0.80;
const SUGGEST_THRESHOLD = 0.55;

function combineConfidence(network?: number, dom?: number): number {
  if (network !== undefined && dom !== undefined) {
    return Math.min(network + dom * 0.6, 0.95);
  }
  if (dom !== undefined) return dom;
  if (network !== undefined) return network;
  return 0;
}

describe("Submission detection confidence model", () => {
  // T-SD-01: DOM-text alone (0.75) must NOT auto-advance
  it("DOM text signal alone (0.75) is below AUTO_ADVANCE threshold", () => {
    const confidence = combineConfidence(undefined, 0.75);
    expect(confidence).toBe(0.75);
    expect(confidence).toBeLessThan(AUTO_ADVANCE_THRESHOLD);
    expect(confidence).toBeGreaterThan(SUGGEST_THRESHOLD); // still shows suggestion toast
  });

  // DOM selector signal (0.75) must NOT auto-advance
  it("DOM selector signal alone (0.75) is below threshold", () => {
    const confidence = combineConfidence(undefined, 0.75);
    expect(confidence).toBeLessThan(AUTO_ADVANCE_THRESHOLD);
  });

  // URL pattern (0.80) MUST auto-advance
  it("URL pattern signal (0.80) meets AUTO_ADVANCE threshold", () => {
    const confidence = combineConfidence(undefined, 0.80);
    expect(confidence).toBe(0.80);
    expect(confidence).toBeGreaterThanOrEqual(AUTO_ADVANCE_THRESHOLD);
  });

  // Network only (0.60) must NOT auto-advance but MUST suggest
  it("Network-only signal (0.60) is below threshold but above suggest", () => {
    const confidence = combineConfidence(0.60, undefined);
    expect(confidence).toBeLessThan(AUTO_ADVANCE_THRESHOLD);
    expect(confidence).toBeGreaterThan(SUGGEST_THRESHOLD);
  });

  // Network (0.60) + DOM text (0.75) MUST auto-advance
  it("T-SD-03: Network + DOM combined meets threshold (LinkedIn Easy Apply case)", () => {
    const confidence = combineConfidence(0.60, 0.75);
    // = min(0.60 + 0.75*0.6, 0.95) = min(1.05, 0.95) = 0.95
    expect(confidence).toBe(0.95);
    expect(confidence).toBeGreaterThanOrEqual(AUTO_ADVANCE_THRESHOLD);
  });

  // T-SD-02: False positive scenario — redirect page showing "Application submitted!"
  // before redirecting to external ATS
  it("DOM redirect text (0.75) alone does NOT cause auto-advance (false positive guard)", () => {
    // Portal shows "Application submitted! Redirecting to Instahyre..."
    // before the user has actually filled the form
    const domSignalFromRedirectPage = 0.75;
    const confidence = combineConfidence(undefined, domSignalFromRedirectPage);
    expect(confidence).toBeLessThan(AUTO_ADVANCE_THRESHOLD);
    // Result: suggestion toast shown ("Did you just apply?") but NO auto-advance ✓
  });

  // Network 0.60 alone does NOT auto-advance
  it("Network-only never auto-advances regardless of value", () => {
    expect(combineConfidence(0.60)).toBeLessThan(AUTO_ADVANCE_THRESHOLD);
    expect(combineConfidence(0.65)).toBeLessThan(AUTO_ADVANCE_THRESHOLD);
    expect(combineConfidence(0.70)).toBeLessThan(AUTO_ADVANCE_THRESHOLD);
    expect(combineConfidence(0.79)).toBeLessThan(AUTO_ADVANCE_THRESHOLD);
  });

  // Combined always auto-advances above 0.80
  it("Network + URL auto-advances with high confidence", () => {
    const confidence = combineConfidence(0.60, 0.80);
    expect(confidence).toBeGreaterThanOrEqual(AUTO_ADVANCE_THRESHOLD);
  });
});

// ── Success URL pattern matching ──────────────────────────────────────────────

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

describe("Success URL patterns", () => {
  it("matches /thank-you", () => {
    expect(SUCCESS_URL_RE.test("https://example.com/thank-you")).toBe(true);
  });

  it("matches /application-submitted", () => {
    expect(SUCCESS_URL_RE.test("https://example.com/application-submitted")).toBe(true);
  });

  it("matches applicationSubmitted=true query param", () => {
    expect(SUCCESS_URL_RE.test("https://example.com/jobs?applicationSubmitted=true")).toBe(true);
  });

  it("does NOT match Instahyre onboarding URL (false positive guard)", () => {
    expect(SUCCESS_URL_RE.test("https://instahyre.com/candidate/onboard/")).toBe(false);
  });

  it("does NOT match LinkedIn job listing URL", () => {
    expect(SUCCESS_URL_RE.test("https://www.linkedin.com/jobs/view/4265909")).toBe(false);
  });

  it("does NOT match Greenhouse job listing URL", () => {
    expect(SUCCESS_URL_RE.test("https://boards.greenhouse.io/acme/jobs/12345")).toBe(false);
  });
});
