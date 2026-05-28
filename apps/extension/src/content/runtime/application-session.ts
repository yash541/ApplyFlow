/**
 * Apply-session storage layer using chrome.storage.session.
 *
 * chrome.storage.session survives content-script reloads, SPA navigations,
 * and cross-origin redirects within the same browsing session. It is
 * automatically cleared when the browser session ends.
 *
 * All functions are async-safe and silently fail — callers must never
 * depend on these succeeding to run the core extension flow.
 */

const SESSION_KEY = "af_apply_session";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export type ApplySessionState =
  | "starting"
  | "redirecting"
  | "form_detected"
  | "filling"
  | "submitted"
  | "abandoned";

export type ApplySession = {
  sessionId: string;
  applicationId: string;
  fingerprintHash: string;
  sourcePortal: string;
  currentPortal: string;
  tailoredResumeId?: string;
  startedAt: number;
  currentState: ApplySessionState;
  currentUrl: string;
  lastUpdatedAt: number;
  // Set by the background dynamic-injection router. Optional keeps this
  // backward compatible with sessions created before the router is available.
  sourceTabId?: number;
};

// ── Storage helpers ───────────────────────────────────────────────────────────

function getStorage(): typeof chrome.storage.session | null {
  try {
    return chrome?.storage?.session ?? null;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function createApplySession(
  params: Pick<
    ApplySession,
    "applicationId" | "fingerprintHash" | "sourcePortal" | "tailoredResumeId"
  >,
): Promise<ApplySession | null> {
  const storage = getStorage();
  if (!storage) return null;

  const now = Date.now();
  const session: ApplySession = {
    sessionId: crypto.randomUUID(),
    applicationId: params.applicationId,
    fingerprintHash: params.fingerprintHash,
    sourcePortal: params.sourcePortal,
    currentPortal: params.sourcePortal,
    tailoredResumeId: params.tailoredResumeId,
    startedAt: now,
    currentState: "starting",
    currentUrl: window.location.href,
    lastUpdatedAt: now,
  };

  try {
    await storage.set({ [SESSION_KEY]: session });
    return session;
  } catch {
    return null;
  }
}

export async function getApplySession(): Promise<ApplySession | null> {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const result = await storage.get(SESSION_KEY);
    const session = result[SESSION_KEY] as ApplySession | undefined;
    if (!session) return null;

    // Auto-expire stale sessions
    if (Date.now() - session.lastUpdatedAt > SESSION_TIMEOUT_MS) {
      await clearApplySession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function updateApplySession(
  patch: Partial<Omit<ApplySession, "sessionId" | "startedAt">>,
): Promise<ApplySession | null> {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const existing = await getApplySession();
    if (!existing) return null;

    const updated: ApplySession = {
      ...existing,
      ...patch,
      lastUpdatedAt: Date.now(),
    };
    await storage.set({ [SESSION_KEY]: updated });
    return updated;
  } catch {
    return null;
  }
}

export async function clearApplySession(): Promise<void> {
  const storage = getStorage();
  if (!storage) return;
  try {
    await storage.remove(SESSION_KEY);
  } catch {
    // Best-effort — clearing session must never throw
  }
}
