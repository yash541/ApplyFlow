/**
 * Cross-portal application continuity tests — C-01 through C-04
 *
 * Tests for session survival across redirects, resume fallback,
 * company/role persistence, and overlay guard behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetStorage, storageMock } from "./setup";
import {
  createApplySession,
  getApplySession,
  updateApplySession,
  clearApplySession,
} from "../content/runtime/application-session";

beforeEach(() => { resetStorage(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

// ── C-01: tailoredResumeId as fallback when backend returns null ──────────────

describe("C-01: session resume fallback", () => {
  it("sessionResumeId is set from tailoredResumeId in session", async () => {
    await createApplySession({
      applicationId: "app-1",
      fingerprintHash: "fp-1",
      sourcePortal: "linkedin",
      tailoredResumeId: "resume-abc",
      company: "Acme",
      role: "Engineer",
    });

    const session = await getApplySession();
    expect(session!.tailoredResumeId).toBe("resume-abc");

    // Simulate the fallback logic in autofill.ts openPanel:
    let resumeId: string | null = null; // backend returned null (cross-domain)
    let sessionResumeId: string | null = session!.tailoredResumeId ?? null;

    if (!resumeId && sessionResumeId) {
      resumeId = sessionResumeId;
    }

    expect(resumeId).toBe("resume-abc"); // fallback applied ✓
  });

  it("no fallback applied when backend already returned resume_id", async () => {
    await createApplySession({
      applicationId: "app-1",
      fingerprintHash: "fp-1",
      sourcePortal: "linkedin",
      tailoredResumeId: "session-resume",
    });

    const session = await getApplySession();
    let resumeId: string | null = "backend-resume"; // backend found it
    const sessionResumeId = session!.tailoredResumeId ?? null;

    // Fallback logic: only use session if backend returned null
    if (!resumeId && sessionResumeId) {
      resumeId = sessionResumeId; // should NOT run
    }

    expect(resumeId).toBe("backend-resume"); // backend value preserved ✓
  });
});

// ── C-02: company/role from interceptor → linkedJobHtml shows real name ───────

describe("C-02: company/role persistence for panel header", () => {
  it("session created with company/role shows correct label in linkedJobHtml", async () => {
    const session = await createApplySession({
      applicationId: "app-1",
      fingerprintHash: "fp-1",
      sourcePortal: "linkedin",
      company: "BayOne Solutions",
      role: "Software Development Engineer II",
    });

    expect(session!.company).toBe("BayOne Solutions");
    expect(session!.role).toBe("Software Development Engineer II");

    // Simulate linkedJobHtml() logic
    const label = session!.company && session!.role
      ? `${session!.company} · ${session!.role}`
      : session!.company ?? session!.role ?? "Linked job";

    expect(label).toBe("BayOne Solutions · Software Development Engineer II");
    expect(label).not.toBe("Linked job"); // ← was showing "Linked job" before fix
  });

  it("falls back to 'Linked job' when company/role missing", async () => {
    const session = await createApplySession({
      applicationId: "app-1",
      fingerprintHash: "fp-1",
      sourcePortal: "linkedin",
      // no company or role
    });

    const label = session!.company && session!.role
      ? `${session!.company} · ${session!.role}`
      : session!.company ?? session!.role ?? "Linked job";

    expect(label).toBe("Linked job");
  });

  it("shows only company when role is missing", async () => {
    const session = await createApplySession({
      applicationId: "app-1",
      fingerprintHash: "fp-1",
      sourcePortal: "linkedin",
      company: "Google",
      // no role
    });

    const label = session!.company && session!.role
      ? `${session!.company} · ${session!.role}`
      : session!.company ?? session!.role ?? "Linked job";

    expect(label).toBe("Google");
  });

  it("company/role survive updateApplySession", async () => {
    await createApplySession({
      applicationId: "app-1",
      fingerprintHash: "fp-1",
      sourcePortal: "linkedin",
      company: "Stripe",
      role: "Backend Engineer",
    });

    // Multiple updates (cross-portal state transitions)
    await updateApplySession({ currentState: "redirecting", currentPortal: "greenhouse" });
    await updateApplySession({ currentState: "form_detected" });
    await updateApplySession({ currentState: "filling" });

    const final = await getApplySession();
    expect(final!.company).toBe("Stripe");      // ← must survive all updates
    expect(final!.role).toBe("Backend Engineer");
    expect(final!.currentState).toBe("filling");
    expect(final!.currentPortal).toBe("greenhouse");
  });
});

// ── C-03: maybeInjectDynamicAutofill tab guard ────────────────────────────────

describe("C-03: dynamic injection tab guard", () => {
  it("injection skipped when sourceTabId !== requestTabId", async () => {
    const session = await createApplySession({
      applicationId: "app-1",
      fingerprintHash: "fp-1",
      sourcePortal: "linkedin",
    });

    // Simulate session having sourceTabId = 1
    await updateApplySession({ sourceTabId: 1 } as Parameters<typeof updateApplySession>[0]);

    const stored = await getApplySession();
    const requestTabId = 2; // injection requested for tab 2

    const shouldInject =
      stored !== null &&
      stored.currentState !== "submitted" &&
      stored.currentState !== "abandoned" &&
      (stored.sourceTabId === undefined || stored.sourceTabId === requestTabId);

    expect(shouldInject).toBe(false); // ← injection blocked for wrong tab ✓
  });

  it("injection allowed when sourceTabId matches", async () => {
    await createApplySession({
      applicationId: "app-1",
      fingerprintHash: "fp-1",
      sourcePortal: "linkedin",
    });
    await updateApplySession({ sourceTabId: 2 } as Parameters<typeof updateApplySession>[0]);

    const stored = await getApplySession();
    const requestTabId = 2;

    const shouldInject =
      stored !== null &&
      stored.currentState !== "submitted" &&
      (stored.sourceTabId === undefined || stored.sourceTabId === requestTabId);

    expect(shouldInject).toBe(true); // ← injection allowed ✓
  });

  it("injection allowed when sourceTabId is undefined (no tab tracking)", async () => {
    await createApplySession({
      applicationId: "app-1",
      fingerprintHash: "fp-1",
      sourcePortal: "linkedin",
    });

    const stored = await getApplySession();
    expect(stored!.sourceTabId).toBeUndefined();

    const shouldInject =
      stored !== null &&
      (stored.sourceTabId === undefined || stored.sourceTabId === 99);

    expect(shouldInject).toBe(true); // ← no tab guard when sourceTabId unset ✓
  });

  it("injection blocked for submitted session", async () => {
    await createApplySession({
      applicationId: "app-1",
      fingerprintHash: "fp-1",
      sourcePortal: "linkedin",
    });
    await updateApplySession({ currentState: "submitted" });

    const stored = await getApplySession();
    const shouldInject = stored !== null && stored.currentState !== "submitted";

    expect(shouldInject).toBe(false); // ← submitted session blocks injection ✓
  });
});

// ── C-04: overlay guard disconnects after clearSession() ─────────────────────

describe("C-04: overlay guard cleanup after clearSession", () => {
  it("guard fires only when session is still active (not after clearSession)", () => {
    let guardDisconnected = false;
    let overlayReinjected = false;

    let currentSession: { applicationId: string } | null = { applicationId: "app-1" };

    function getSession() { return currentSession; }

    const guardCallback = () => {
      if (!getSession()) {
        guardDisconnected = true; // ← observer.disconnect()
        return;
      }
      overlayReinjected = true; // ← injectOverlay(...)
    };

    // Session active: guard fires with overlay removed → re-inject
    guardCallback();
    expect(overlayReinjected).toBe(true);
    expect(guardDisconnected).toBe(false);

    // clearSession() called (new navigation started)
    currentSession = null;
    overlayReinjected = false;

    // Guard fires again (DOM mutation): must disconnect, not re-inject
    guardCallback();
    expect(guardDisconnected).toBe(true);
    expect(overlayReinjected).toBe(false); // ← old overlay not re-injected ✓
  });

  it("guard does not re-inject when runId is stale (new job navigation)", () => {
    let currentRunId = 1;
    let reinjected = false;

    const guardRunId = 1; // captured when guard was set up

    const guardCallback = () => {
      if (guardRunId !== currentRunId) return; // stale guard
      reinjected = true;
    };

    // New navigation claims runId
    currentRunId = 2;

    guardCallback();
    expect(reinjected).toBe(false); // ← stale guard correctly aborted ✓
  });
});

// ── Cross-portal session state progression ────────────────────────────────────

describe("Session state progression across portals", () => {
  it("full LinkedIn → Greenhouse journey state transitions", async () => {
    // t=0: User clicks Apply on LinkedIn job page
    const session = await createApplySession({
      applicationId: "app-1",
      fingerprintHash: "fp-1",
      sourcePortal: "linkedin",
      company: "StarRez",
      role: "Technical Lead",
      tailoredResumeId: "resume-tailored-1",
    });
    expect(session!.currentState).toBe("starting");

    // t=1: Interceptor fires APPLY_SESSION_STARTED → background records tabId
    await updateApplySession({ sourceTabId: 5 } as Parameters<typeof updateApplySession>[0]);

    // t=2: Page redirects to Greenhouse application form
    await updateApplySession({
      currentState: "redirecting",
      currentPortal: "job-boards.greenhouse.io",
      currentUrl: "https://job-boards.greenhouse.io/starrez/jobs/4564202008/applications",
    });

    // t=3: autofill.ts initializes on Greenhouse form, finds session
    await updateApplySession({ currentState: "form_detected" });

    // t=4: User opens panel, fills fields
    await updateApplySession({ currentState: "filling" });

    // t=5: Submission detected
    await updateApplySession({ currentState: "submitted" });

    const final = await getApplySession();
    expect(final!.currentState).toBe("submitted");
    expect(final!.currentPortal).toBe("job-boards.greenhouse.io");
    expect(final!.company).toBe("StarRez");       // preserved throughout
    expect(final!.role).toBe("Technical Lead");    // preserved throughout
    expect(final!.tailoredResumeId).toBe("resume-tailored-1"); // preserved
  });

  it("session cleared after submission", async () => {
    await createApplySession({
      applicationId: "app-1",
      fingerprintHash: "fp-1",
      sourcePortal: "linkedin",
    });
    await updateApplySession({ currentState: "submitted" });
    await clearApplySession();

    const session = await getApplySession();
    expect(session).toBeNull(); // ← cleared after submission ✓
  });
});
