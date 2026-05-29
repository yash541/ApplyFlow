import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetStorage, storageMock } from "./setup";
import {
  createApplySession,
  getApplySession,
  updateApplySession,
  clearApplySession,
} from "../content/runtime/application-session";

beforeEach(() => {
  resetStorage();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const baseParams = {
  applicationId: "app-123",
  fingerprintHash: "abc123",
  sourcePortal: "linkedin",
  tailoredResumeId: "resume-456",
  company: "Acme Corp",
  role: "Software Engineer",
};

// ── createApplySession ────────────────────────────────────────────────────────

describe("createApplySession", () => {
  it("creates a session with all required fields", async () => {
    const session = await createApplySession(baseParams);
    expect(session).not.toBeNull();
    expect(session!.applicationId).toBe("app-123");
    expect(session!.fingerprintHash).toBe("abc123");
    expect(session!.sourcePortal).toBe("linkedin");
    expect(session!.currentPortal).toBe("linkedin");
    expect(session!.company).toBe("Acme Corp");
    expect(session!.role).toBe("Software Engineer");
    expect(session!.tailoredResumeId).toBe("resume-456");
    expect(session!.currentState).toBe("starting");
    expect(session!.sessionId).toBeTruthy();
  });

  it("stores session in chrome.storage.session", async () => {
    await createApplySession(baseParams);
    const stored = storageMock.session["af_apply_session"];
    expect(stored).toBeTruthy();
    expect((stored as { applicationId: string }).applicationId).toBe("app-123");
  });

  it("creates session without optional tailoredResumeId", async () => {
    const session = await createApplySession({ ...baseParams, tailoredResumeId: undefined });
    expect(session!.tailoredResumeId).toBeUndefined();
  });
});

// ── getApplySession ───────────────────────────────────────────────────────────

describe("getApplySession", () => {
  it("returns null when no session exists", async () => {
    const session = await getApplySession();
    expect(session).toBeNull();
  });

  it("returns the session when it exists", async () => {
    await createApplySession(baseParams);
    const session = await getApplySession();
    expect(session!.applicationId).toBe("app-123");
  });

  it("T-AS-003: returns null and clears expired session (>30 min)", async () => {
    await createApplySession(baseParams);
    // Advance time by 31 minutes
    vi.advanceTimersByTime(31 * 60 * 1000);
    const session = await getApplySession();
    expect(session).toBeNull();
    // Verify it was cleaned up from storage
    expect(storageMock.session["af_apply_session"]).toBeUndefined();
  });

  it("T-AS-002: session NOT expired at 29 minutes", async () => {
    await createApplySession(baseParams);
    vi.advanceTimersByTime(29 * 60 * 1000);
    const session = await getApplySession();
    expect(session).not.toBeNull();
  });
});

// ── updateApplySession ────────────────────────────────────────────────────────

describe("updateApplySession", () => {
  it("updates currentState", async () => {
    await createApplySession(baseParams);
    await updateApplySession({ currentState: "form_detected" });
    const session = await getApplySession();
    expect(session!.currentState).toBe("form_detected");
  });

  it("preserves existing fields when partially updating", async () => {
    await createApplySession(baseParams);
    await updateApplySession({ currentState: "filling" });
    const session = await getApplySession();
    expect(session!.applicationId).toBe("app-123"); // not overwritten
    expect(session!.company).toBe("Acme Corp");      // not overwritten
    expect(session!.currentState).toBe("filling");
  });

  it("returns null when no session to update", async () => {
    const result = await updateApplySession({ currentState: "filling" });
    expect(result).toBeNull();
  });

  it("updates lastUpdatedAt on every update", async () => {
    await createApplySession(baseParams);
    const before = (await getApplySession())!.lastUpdatedAt;
    vi.advanceTimersByTime(1000);
    await updateApplySession({ currentState: "form_detected" });
    const after = (await getApplySession())!.lastUpdatedAt;
    expect(after).toBeGreaterThan(before);
  });
});

// ── clearApplySession ─────────────────────────────────────────────────────────

describe("clearApplySession", () => {
  it("removes session from storage", async () => {
    await createApplySession(baseParams);
    await clearApplySession();
    expect(storageMock.session["af_apply_session"]).toBeUndefined();
    const session = await getApplySession();
    expect(session).toBeNull();
  });

  it("does not throw when no session exists", async () => {
    await expect(clearApplySession()).resolves.toBeUndefined();
  });
});

// ── company/role persistence (REG-023) ───────────────────────────────────────

describe("company and role in session", () => {
  it("stores company and role from interceptor", async () => {
    const session = await createApplySession({
      ...baseParams,
      company: "BayOne Solutions",
      role: "Software Development Engineer II",
    });
    expect(session!.company).toBe("BayOne Solutions");
    expect(session!.role).toBe("Software Development Engineer II");
  });

  it("company and role survive update cycle", async () => {
    await createApplySession({ ...baseParams, company: "Stripe", role: "Backend Engineer" });
    await updateApplySession({ currentState: "form_detected" });
    const session = await getApplySession();
    expect(session!.company).toBe("Stripe");
    expect(session!.role).toBe("Backend Engineer");
  });
});
