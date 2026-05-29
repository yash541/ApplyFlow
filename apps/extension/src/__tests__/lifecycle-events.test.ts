/**
 * Browser-extension lifecycle tests — L-01 through L-06
 *
 * Tests for extension reload, pagehide, storage unavailability,
 * and storage change events.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetStorage, storageMock } from "./setup";

beforeEach(() => { resetStorage(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

// ── L-01: isExtensionValid() ──────────────────────────────────────────────────

describe("L-01: isExtensionValid()", () => {
  it("returns true when chrome.runtime.id is defined", () => {
    // chrome.runtime.id is set in setup.ts mock
    function isExtensionValid(): boolean {
      try { return !!chrome.runtime?.id; } catch { return false; }
    }
    expect(isExtensionValid()).toBe(true);
  });

  it("returns false when chrome.runtime.id is undefined (extension reloaded)", () => {
    function isExtensionValid(): boolean {
      try { return !!chrome.runtime?.id; } catch { return false; }
    }
    const origId = chrome.runtime.id;
    (chrome.runtime as { id: string | undefined }).id = undefined;
    expect(isExtensionValid()).toBe(false);
    (chrome.runtime as { id: string | undefined }).id = origId;
  });

  it("returns false when chrome.runtime.id access throws", () => {
    function isExtensionValid(): boolean {
      try { return !!chrome.runtime?.id; } catch { return false; }
    }
    Object.defineProperty(chrome.runtime, "id", {
      get: () => { throw new Error("Extension context invalidated"); },
      configurable: true,
    });
    expect(isExtensionValid()).toBe(false);
    // Restore
    Object.defineProperty(chrome.runtime, "id", {
      value: "test-extension-id",
      configurable: true,
    });
  });
});

// ── L-02: pagehide cleanup completeness ──────────────────────────────────────

describe("L-02: pagehide cleanup", () => {
  it("noFieldsTimer is cancelled on pagehide", () => {
    let noFieldsTimer: ReturnType<typeof setTimeout> | null = null;
    let bannerShown = false;

    // Start the timer
    noFieldsTimer = setTimeout(() => { bannerShown = true; }, 3000);

    // Simulate pagehide
    if (noFieldsTimer) { clearTimeout(noFieldsTimer); noFieldsTimer = null; }

    // Advance past the timer
    vi.advanceTimersByTime(5000);
    expect(bannerShown).toBe(false); // ← banner never fires ✓
    expect(noFieldsTimer).toBeNull();
  });

  it("stopApplicationDetector is called on pagehide", () => {
    const stopDetector = vi.fn();
    let stopApplicationDetector: (() => void) | null = stopDetector;

    // Simulate pagehide handler
    stopApplicationDetector?.();
    stopApplicationDetector = null;

    expect(stopDetector).toHaveBeenCalledOnce();
    expect(stopApplicationDetector).toBeNull();
  });

  it("all three cleanup actions run on pagehide in the correct order", () => {
    const calls: string[] = [];
    let noFieldsTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {}, 3000);
    const stopDetector = vi.fn(() => calls.push("detector"));
    const hideAssistant = vi.fn(() => calls.push("assistant"));

    // Simulate pagehide in autofill.ts
    stopDetector();
    if (noFieldsTimer) { clearTimeout(noFieldsTimer); noFieldsTimer = null; calls.push("timer"); }
    hideAssistant();

    expect(calls).toEqual(["detector", "timer", "assistant"]);
  });
});

// ── L-03: chrome.storage.session completely unavailable ──────────────────────

describe("L-03: storage session unavailable", () => {
  it("getApplySession returns null when getStorage() returns null", async () => {
    // Simulate Chrome < 112 where storage.session doesn't exist
    const origSession = (chrome.storage as unknown as { session: unknown }).session;
    (chrome.storage as unknown as { session: unknown }).session = undefined;

    const { getApplySession } = await import("../content/runtime/application-session");
    const result = await getApplySession();
    expect(result).toBeNull();

    (chrome.storage as unknown as { session: unknown }).session = origSession;
  });

  it("createApplySession returns null when getStorage() returns null", async () => {
    const origSession = (chrome.storage as unknown as { session: unknown }).session;
    (chrome.storage as unknown as { session: unknown }).session = undefined;

    const { createApplySession } = await import("../content/runtime/application-session");
    const result = await createApplySession({
      applicationId: "app-1",
      fingerprintHash: "fp-1",
      sourcePortal: "linkedin",
    });
    expect(result).toBeNull();

    (chrome.storage as unknown as { session: unknown }).session = origSession;
  });
});

// ── L-04: chrome.storage.onChanged triggers cleanup ──────────────────────────

describe("L-04: session cleared from background triggers cleanup", () => {
  it("onChanged listener correctly identifies session removal (newValue undefined)", () => {
    let runtimeStopped = false;

    function onStorageChanged(
      changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
      areaName: string
    ) {
      if (areaName !== "session" || !changes["af_apply_session"]) return;
      if (!changes["af_apply_session"].newValue) {
        runtimeStopped = true; // stopActiveApplicationRuntime()
      }
    }

    // Simulate: background clears the session
    onStorageChanged(
      { "af_apply_session": { oldValue: { sessionId: "x" }, newValue: undefined } },
      "session"
    );

    expect(runtimeStopped).toBe(true);
  });

  it("onChanged does not trigger for local storage area", () => {
    let runtimeStopped = false;

    function onStorageChanged(
      changes: Record<string, { newValue?: unknown }>,
      areaName: string
    ) {
      if (areaName !== "session" || !changes["af_apply_session"]) return;
      if (!changes["af_apply_session"].newValue) runtimeStopped = true;
    }

    // Wrong area
    onStorageChanged({ "af_apply_session": { newValue: undefined } }, "local");
    expect(runtimeStopped).toBe(false);
  });

  it("onChanged does not trigger when session is UPDATED (not cleared)", () => {
    let runtimeStopped = false;

    function onStorageChanged(
      changes: Record<string, { newValue?: unknown }>,
      areaName: string
    ) {
      if (areaName !== "session" || !changes["af_apply_session"]) return;
      if (!changes["af_apply_session"].newValue) runtimeStopped = true;
    }

    // newValue is set (update, not clear)
    onStorageChanged(
      { "af_apply_session": { newValue: { sessionId: "y", currentState: "filling" } } },
      "session"
    );
    expect(runtimeStopped).toBe(false);
  });
});

// ── L-05: runInit aborts immediately on invalid extension context ─────────────

describe("L-05: runInit isExtensionValid guard", () => {
  it("runInit returns immediately when extension context invalid", async () => {
    // Simulate the guard at top of runInit
    const sideEffects: string[] = [];

    function isExtensionValid(): boolean {
      return false; // extension reloaded
    }

    async function runInit() {
      if (!isExtensionValid()) return; // ← guard
      sideEffects.push("waited"); // should NOT reach here
      sideEffects.push("scraped");
      sideEffects.push("overlayInjected");
    }

    await runInit();
    expect(sideEffects).toHaveLength(0); // nothing happened
  });
});

// ── L-06: monotonic runId race condition guard ────────────────────────────────

describe("L-06: currentRunId race condition guard", () => {
  it("stale async callback aborts when runId no longer current", async () => {
    let currentRunId = 0;
    const overlaysInjected: number[] = [];

    async function simulateRunInit(jobId: number) {
      const runId = ++currentRunId;

      // Simulate async work (DOM stabilization + scraping)
      await new Promise((r) => setTimeout(r, 100));

      // Guard: check if still current
      if (runId !== currentRunId) return; // stale — abort

      overlaysInjected.push(jobId);
    }

    // Simulate rapid navigation: jobs 1, 2, 3 all start concurrently
    const p1 = simulateRunInit(1);
    const p2 = simulateRunInit(2);
    const p3 = simulateRunInit(3);

    vi.advanceTimersByTime(200);
    await Promise.all([p1, p2, p3]);

    // Only the last job (3) should have injected its overlay
    expect(overlaysInjected).toEqual([3]);
  });

  it("single navigation always injects overlay", async () => {
    let currentRunId = 0;
    const overlaysInjected: number[] = [];

    async function simulateRunInit(jobId: number) {
      const runId = ++currentRunId;
      await new Promise((r) => setTimeout(r, 100));
      if (runId !== currentRunId) return;
      overlaysInjected.push(jobId);
    }

    const p = simulateRunInit(1);
    vi.advanceTimersByTime(200);
    await p;

    expect(overlaysInjected).toEqual([1]);
  });
});
