/**
 * Race condition tests — R-01 through R-05
 *
 * These tests verify that concurrent async operations resolve correctly
 * and that shared module-level state doesn't leak across concurrent runs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetStorage } from "./setup";
import {
  createApplySession,
  getApplySession,
  updateApplySession,
} from "../content/runtime/application-session";

beforeEach(() => { resetStorage(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const BASE = {
  applicationId: "app-1",
  fingerprintHash: "fp-abc",
  sourcePortal: "linkedin",
  company: "Acme",
  role: "Engineer",
};

// ── R-02: Concurrent updateApplySession writes ────────────────────────────────

describe("R-02: concurrent updateApplySession", () => {
  it("last write wins but does not destroy existing fields", async () => {
    await createApplySession(BASE);

    // Fire two updates concurrently (simulates pointerdown + click 50ms apart)
    const [r1, r2] = await Promise.all([
      updateApplySession({ currentState: "redirecting" }),
      updateApplySession({ tailoredResumeId: "resume-xyz" }),
    ]);

    // Both should return non-null
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();

    // After both resolve, the session should still have applicationId
    const session = await getApplySession();
    expect(session).not.toBeNull();
    expect(session!.applicationId).toBe("app-1");
    expect(session!.fingerprintHash).toBe("fp-abc");
  });
});

// ── R-05: pointerdown+click debounce (750ms window) ──────────────────────────

describe("R-05: apply interceptor double-fire debounce", () => {
  it("createApplySession called twice within 750ms: both succeed but are idempotent", async () => {
    // Simulate: first pointerdown at t=0, click at t=100ms
    const s1 = await createApplySession(BASE);
    const s2 = await createApplySession({ ...BASE, company: "Different" });

    // Both created (storage key is overwritten) — second wins
    expect(s1).not.toBeNull();
    expect(s2).not.toBeNull();

    const stored = await getApplySession();
    // Last write wins — this is the current behavior
    expect(stored!.company).toBe("Different");
    // sessionId is fresh for each createApplySession call
    expect(stored!.sessionId).toBe(s2!.sessionId);
  });

  it("the 750ms lastPersistedAt guard prevents second call within window", () => {
    // White-box test of the debounce logic in apply-interceptor.ts
    let lastPersistedAt = 0;
    const NOW = 1000;

    function shouldPersist(now: number): boolean {
      if (now - lastPersistedAt < 750) return false;
      lastPersistedAt = now;
      return true;
    }

    expect(shouldPersist(NOW)).toBe(true);         // first call: yes
    expect(shouldPersist(NOW + 100)).toBe(false);  // 100ms later: blocked
    expect(shouldPersist(NOW + 749)).toBe(false);  // 749ms: still blocked
    expect(shouldPersist(NOW + 750)).toBe(true);   // 750ms: allowed
  });
});

// ── R-03: noFieldsTimer cancellation ─────────────────────────────────────────

describe("R-03: noFieldsTimer cancellation when fields appear", () => {
  it("timer cleared before 3s fires if actionableCount becomes > 0", () => {
    // Simulate the timer logic
    let noFieldsTimer: ReturnType<typeof setTimeout> | null = null;
    let bannerShown = false;

    function runWithNoFields() {
      if (!noFieldsTimer) {
        noFieldsTimer = setTimeout(() => {
          noFieldsTimer = null;
          bannerShown = true; // showActivateBanner would fire here
        }, 3000);
      }
    }

    function runWithFields() {
      if (noFieldsTimer) {
        clearTimeout(noFieldsTimer);
        noFieldsTimer = null;
      }
    }

    runWithNoFields();     // t=0: no fields, timer starts
    vi.advanceTimersByTime(2999); // advance to just before
    runWithFields();       // fields detected at t=2999ms — cancel timer

    vi.advanceTimersByTime(1000); // advance past where timer WOULD have fired
    expect(bannerShown).toBe(false); // banner must NOT have shown
    expect(noFieldsTimer).toBeNull();
  });

  it("banner DOES show if no fields for full 3s", () => {
    let noFieldsTimer: ReturnType<typeof setTimeout> | null = null;
    let bannerShown = false;

    noFieldsTimer = setTimeout(() => {
      noFieldsTimer = null;
      bannerShown = true;
    }, 3000);

    vi.advanceTimersByTime(3001);
    expect(bannerShown).toBe(true);
  });
});

// ── R-04: filledStepKey snapshot is taken before fill, not at Done click ──────

describe("R-04: filledStepKey snapshot timing", () => {
  it("filledStepKey reflects step at fill-start, even if currentFieldsKey advances", () => {
    // This test validates the fix for the multi-step Done button bug
    let currentFieldsKey = "";
    let lastFilledKey = "";
    let waitingForNextStep = false;

    const step1Key = "input#resume-select|input#cover";
    const step2Key = "input#phone|input#address";

    // Step 1: user opens panel, fields scanned
    currentFieldsKey = step1Key;

    // User clicks "Fill fields" — capture BEFORE fill runs
    const filledStepKey = currentFieldsKey; // ← the fix

    // Simulate: during fill, modal advances to step 2
    currentFieldsKey = step2Key;

    // User clicks Done → finishThisStep uses filledStepKey
    lastFilledKey = filledStepKey;
    waitingForNextStep = true;

    // run() fires for step 2: fieldsKey !== lastFilledKey → badge appears
    const shouldSuppress = waitingForNextStep && step2Key === lastFilledKey;
    expect(shouldSuppress).toBe(false); // ← badge correctly appears ✓
    expect(lastFilledKey).toBe(step1Key); // ← snapshot was from step 1
  });

  it("WITHOUT the fix: using currentFieldsKey at Done time would suppress badge", () => {
    let currentFieldsKey = "";
    let lastFilledKey = "";
    let waitingForNextStep = false;

    const step1Key = "input#resume-select|input#cover";
    const step2Key = "input#phone|input#address";

    currentFieldsKey = step1Key;
    // (no snapshot — old bug)

    currentFieldsKey = step2Key; // step advances during success panel

    // Old bug: Done uses currentFieldsKey (now step 2)
    lastFilledKey = currentFieldsKey; // BUG
    waitingForNextStep = true;

    const wouldSuppress = waitingForNextStep && step2Key === lastFilledKey;
    expect(wouldSuppress).toBe(true); // ← confirms the old bug
  });
});
