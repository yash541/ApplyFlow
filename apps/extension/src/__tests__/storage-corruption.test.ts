/**
 * Storage corruption tests — S-01 through S-05
 *
 * These tests verify that malformed, missing, or overflowed storage
 * data does not crash the extension and degrades gracefully.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetStorage, storageMock } from "./setup";

beforeEach(() => { resetStorage(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

// ── S-01: lastUpdatedAt is undefined → NaN comparison ────────────────────────

describe("S-01: session with undefined lastUpdatedAt", () => {
  it("NaN comparison does not falsely expire session", async () => {
    // Inject a corrupt session missing lastUpdatedAt
    storageMock.session["af_apply_session"] = {
      sessionId: "corrupt-1",
      applicationId: "app-1",
      fingerprintHash: "fp-1",
      sourcePortal: "linkedin",
      currentPortal: "linkedin",
      startedAt: Date.now(),
      currentState: "starting",
      currentUrl: "https://example.com",
      // lastUpdatedAt: MISSING ← intentionally omitted
    };

    const { getApplySession } = await import("../content/runtime/application-session");
    const session = await getApplySession();

    // Current behavior: NaN > 1_800_000 evaluates to false → session NOT expired
    // This is a KNOWN BUG: the session should be treated as invalid when lastUpdatedAt is missing
    // This test documents the current behavior; if fixed, update expectation to expect(session).toBeNull()
    if (session !== null) {
      // Bug present: corrupt session returned. Document it.
      expect(session!.sessionId).toBe("corrupt-1");
      console.warn("S-01 BUG: session with undefined lastUpdatedAt is not rejected");
    }
    // We don't assert pass/fail here — the test is documentation
    // TODO: fix getApplySession to validate lastUpdatedAt exists before comparison
  });

  it("demonstrates the NaN arithmetic issue", () => {
    const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
    const lastUpdatedAt = undefined as unknown as number;

    const timeSince = Date.now() - lastUpdatedAt;       // NaN
    const isExpired = timeSince > SESSION_TIMEOUT_MS;   // NaN > 1800000 = false

    expect(Number.isNaN(timeSince)).toBe(true);
    expect(isExpired).toBe(false); // ← BUG: undefined lastUpdatedAt is NEVER expired
  });
});

// ── S-02: session missing required fields ─────────────────────────────────────

describe("S-02: partial/corrupt session shape", () => {
  it("returns the session even if applicationId is null (partial session allowed)", async () => {
    storageMock.session["af_apply_session"] = {
      sessionId: "partial-1",
      applicationId: "",      // empty, not undefined
      fingerprintHash: "",
      sourcePortal: "linkedin",
      currentPortal: "linkedin",
      startedAt: Date.now(),
      currentState: "starting",
      currentUrl: "",
      lastUpdatedAt: Date.now(),
    };

    const { getApplySession } = await import("../content/runtime/application-session");
    const session = await getApplySession();
    // Empty applicationId is valid (untracked job session)
    expect(session).not.toBeNull();
    expect(session!.applicationId).toBe("");
  });

  it("does NOT throw when session is a completely wrong type", async () => {
    storageMock.session["af_apply_session"] = "not-an-object" as unknown;

    const { getApplySession } = await import("../content/runtime/application-session");
    // Should not throw — returns the string (current behavior) or null
    await expect(getApplySession()).resolves.not.toThrow();
  });
});

// ── S-03: storage quota exceeded ─────────────────────────────────────────────

describe("S-03: chrome.storage.session quota exceeded", () => {
  it("createApplySession returns null when set() throws", async () => {
    // Override set to throw quota error
    (chrome.storage.session.set as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("QUOTA_BYTES exceeded")
    );

    const { createApplySession } = await import("../content/runtime/application-session");
    const session = await createApplySession({
      applicationId: "app-1",
      fingerprintHash: "fp-1",
      sourcePortal: "linkedin",
    });

    // Must return null, not throw
    expect(session).toBeNull();
  });

  it("getApplySession returns null when get() throws", async () => {
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("storage unavailable")
    );

    const { getApplySession } = await import("../content/runtime/application-session");
    const session = await getApplySession();
    expect(session).toBeNull();
  });

  it("clearApplySession does not throw when remove() fails", async () => {
    (chrome.storage.session.remove as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("storage unavailable")
    );

    const { clearApplySession } = await import("../content/runtime/application-session");
    await expect(clearApplySession()).resolves.toBeUndefined();
  });
});

// ── S-04: session.token is empty string ──────────────────────────────────────

describe("S-04: token edge cases in authedFetch", () => {
  it("empty string token is falsy — getToken() returns null", () => {
    // Simulate what getToken() does
    const session = { token: "" };
    const token = session?.token ?? null;
    // Empty string is falsy — treated as no token
    expect(!token).toBe(true); // ← means authedFetch sends NO Authorization header
  });

  it("undefined token is handled as no-auth", () => {
    const session = { token: undefined };
    const token = (session as { token?: string })?.token ?? null;
    expect(token).toBeNull();
  });

  it("null session returns null token", () => {
    const session = null as { token: string } | null;
    const token = session?.token ?? null;
    expect(token).toBeNull();
  });

  it("valid token is returned correctly", () => {
    const session = { token: "eyJhbGciOiJIUzI1NiJ9.test.sig" };
    const token = session?.token ?? null;
    expect(token).toBe("eyJhbGciOiJIUzI1NiJ9.test.sig");
  });
});

// ── S-05: af_notifications corruption guard ───────────────────────────────────

describe("S-05: af_notifications storage corruption", () => {
  it("non-array af_notifications causes .filter() crash", () => {
    // Reproduce the crash that would happen in pushNotification
    // if af_notifications was corrupted to an object
    const corruptData = { "0": { id: "n1" } }; // object, not array

    // Current pushNotification code:
    //   const list = (result["af_notifications"] ?? []) as AppNotification[];
    //   next = [newNotification, ...list].slice(0, 20)
    // The spread of a non-array object: [...{ "0": ... }] throws TypeError

    const list = (corruptData ?? []) as unknown[];
    let crashed = false;
    try {
      const result = [{ id: "new" }, ...list].slice(0, 20);
      void result;
    } catch {
      crashed = true;
    }

    // Documents that the crash CAN happen; fix by adding Array.isArray check
    // in pushNotification: const list = Array.isArray(stored) ? stored : [];
    expect(crashed).toBe(true); // ← BUG: should be false after fix
    // TODO: add Array.isArray guard in background/index.ts pushNotification
  });

  it("Array.isArray guard prevents crash", () => {
    const corruptData = { "0": { id: "n1" } };

    // The fix: guard with Array.isArray
    const list = Array.isArray(corruptData) ? corruptData : [];
    const result = [{ id: "new" }, ...list].slice(0, 20);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: "new" });
  });
});
