import type { ExtensionMessage, LinkedInJobData, AppNotification } from "@applyflow/shared";

const API_BASE = "http://localhost:8000";
const WEB_BASE = "http://localhost:3000";
const APPLY_SESSION_KEY = "af_apply_session";
const ALL_URLS_ORIGIN = "<all_urls>";

type BackgroundApplySession = {
  sessionId: string;
  applicationId: string;
  fingerprintHash: string;
  sourcePortal: string;
  currentPortal: string;
  tailoredResumeId?: string;
  startedAt: number;
  currentState: string;
  currentUrl: string;
  lastUpdatedAt: number;
  sourceTabId?: number;
};

// chrome.storage.session is trusted-context only by default in MV3.
// Apply sessions are intentionally written/read by content scripts so they can
// survive cross-origin apply redirects without involving persistent local state.
void chrome.storage.session?.setAccessLevel?.({
  accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
}).catch(() => {
  // Backward compatibility: older Chrome versions may not support this setter.
  // In that case the extension falls back to the existing overlay/autofill flow.
});

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    if (message.type === "ANALYZE_JOB") {
      void analyzeJob(message.payload as LinkedInJobData)
        .then(sendResponse)
        .catch(() => sendResponse({ error: "Unexpected error" }));
      return true;
    }

    if (message.type === "GET_SESSION") {
      void chrome.storage.local
        .get("session")
        .then((result) => sendResponse(result["session"] ?? null))
        .catch(() => sendResponse(null));
      return true;
    }

    if (message.type === "SYNC_APPLICATION") {
      void syncApplication(message.payload as { jobData: LinkedInJobData; status: string })
        .then(sendResponse)
        .catch(() => sendResponse({ error: "Unexpected error" }));
      return true;
    }

    if (message.type === "OPEN_TAILOR") {
      void openTailorTab(message.payload as { jd: string; company: string; role: string; applicationId?: string })
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type === "OPEN_RESUME") {
      void openResumeTab(message.payload as { resumeId: string; applicationId: string })
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type === "CHECK_APPLICATION") {
      void checkApplication(message.payload as { company: string; role: string })
        .then(sendResponse)
        .catch(() => sendResponse(null));
      return true;
    }

    if (message.type === "LOOKUP_BY_URL") {
      void lookupByUrl(message.payload as { url: string })
        .then(sendResponse)
        .catch(() => sendResponse(null));
      return true;
    }

    if (message.type === "UPDATE_APP_STATUS") {
      void updateAppStatus(message.payload as { id: string; status: string })
        .then(sendResponse)
        .catch(() => sendResponse({ error: "Unexpected error" }));
      return true;
    }

    if (message.type === "GET_PROFILE") {
      void getProfile()
        .then(sendResponse)
        .catch(() => sendResponse(null));
      return true;
    }

    if (message.type === "GET_MATCHES") {
      void getMatches(message.payload as { fields: unknown[]; url: string; job_context?: string })
        .then(sendResponse)
        .catch(() => sendResponse({ error: "Match request failed" }));
      return true;
    }

    if (message.type === "SMART_MATCH") {
      void smartMatch(message.payload as { fields: unknown[]; url: string; job_context?: string })
        .then(sendResponse)
        .catch(() => sendResponse({ error: "Smart match failed" }));
      return true;
    }

    if (message.type === "GET_RESUME_PDF") {
      void getResumePdfBytes((message.payload as { resumeId: string }).resumeId)
        .then(sendResponse)
        .catch(() => sendResponse(null));
      return true;
    }

    if (message.type === "NOTIFY") {
      void pushNotification(message.payload as Omit<AppNotification, "id" | "timestamp" | "read">)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type === "MARK_NOTIFICATIONS_READ") {
      void markAllRead().then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message.type === "SAVE_LEARNED_FIELDS") {
      void saveLearnedFields(message.payload as { fields: Record<string, string> })
        .then(sendResponse)
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type === "EXTRACT_JOB_AI") {
      void extractJobAi(message.payload as { pageText: string; url: string; portal?: string })
        .then(sendResponse)
        .catch(() => sendResponse(null));
      return true;
    }

    if (message.type === "RECORD_OBSERVATION") {
      void recordObservation(message.payload as {
        applicationId: string;
        extractionMethod: string;
        portal?: string;
        isLive?: boolean;
        signals?: Record<string, unknown>;
      })
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type === "APPLY_SESSION_STARTED") {
      const tabId = sender.tab?.id;
      void attachApplySessionToTab(tabId)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type === "ENSURE_DYNAMIC_APPLY_PERMISSION") {
      void ensureDynamicApplyPermission()
        .then((granted) => sendResponse({ ok: granted }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type === "TELEMETRY") {
      pushTelemetryEvent(message.payload as Record<string, unknown>);
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "REGENERATE_FIELD") {
      void regenerateField(message.payload as {
        uid: string; kind: string; label: string;
        current_value?: string; url?: string; page_text?: string;
      })
        .then(sendResponse)
        .catch(() => sendResponse({ error: "Regeneration failed" }));
      return true;
    }

    if (message.type === "OPEN_LOGIN") {
      void chrome.tabs.create({ url: `${WEB_BASE}/login` })
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type === "AUTH_LOGIN") {
      void authLogin(message.payload as { email: string; password: string })
        .then(sendResponse)
        .catch(() => sendResponse({ error: "Could not connect to server" }));
      return true;
    }

    if (message.type === "GET_RECENT_APPS") {
      void getRecentApps()
        .then(sendResponse)
        .catch(() => sendResponse(null));
      return true;
    }

    if (message.type === "QUICK_TRACK") {
      void quickTrack(
        message.payload as { company: string; role: string; url?: string },
        sender.tab?.id,
      )
        .then(sendResponse)
        .catch(() => sendResponse({ error: "Unexpected error" }));
      return true;
    }
  },
);

// ── Dynamic apply-session routing ─────────────────────────────────────────────

const lastDynamicInjection = new Map<number, string>();

function isHttpUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function isKnownStaticAutofillUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const path = u.pathname;

    return (
      host === "www.linkedin.com" && path.startsWith("/jobs/") ||
      host === "boards.greenhouse.io" ||
      host.endsWith(".greenhouse.io") ||
      host === "jobs.lever.co" ||
      host.endsWith(".lever.co") ||
      host.endsWith(".myworkdayjobs.com") ||
      host.endsWith(".myworkday.com") ||
      host === "jobs.ashbyhq.com" ||
      host === "apply.workable.com" ||
      host === "jobs.smartrecruiters.com" ||
      host.endsWith(".bamboohr.com") && path.startsWith("/careers/") ||
      host.endsWith(".jobvite.com") ||
      host.endsWith(".icims.com") ||
      host.endsWith(".indeed.com") && path.startsWith("/viewjob") ||
      host === "instahyre.com" ||
      host === "hirist.tech" ||
      host.endsWith(".naukri.com") ||
      host === "cutshort.io" ||
      host.endsWith(".phenompro.com") ||
      host.endsWith(".taleo.net") ||
      host.endsWith(".successfactors.com") ||
      host.endsWith(".successfactors.eu") ||
      host.endsWith(".ultipro.com") ||
      host.endsWith(".paylocity.com") ||
      host === "localhost" && u.port === "3000" && path.startsWith("/demo-apply")
    );
  } catch {
    return false;
  }
}

async function getApplySessionForBackground(): Promise<BackgroundApplySession | null> {
  try {
    const result = await chrome.storage.session.get(APPLY_SESSION_KEY);
    return (result[APPLY_SESSION_KEY] as BackgroundApplySession | undefined) ?? null;
  } catch {
    return null;
  }
}

async function patchApplySessionForBackground(
  patch: Partial<BackgroundApplySession>,
): Promise<BackgroundApplySession | null> {
  const session = await getApplySessionForBackground();
  if (!session) return null;

  const updated: BackgroundApplySession = {
    ...session,
    ...patch,
    lastUpdatedAt: Date.now(),
  };
  await chrome.storage.session.set({ [APPLY_SESSION_KEY]: updated });
  return updated;
}

async function attachApplySessionToTab(tabId: number | undefined): Promise<void> {
  if (tabId === undefined) return;
  await patchApplySessionForBackground({ sourceTabId: tabId });
}

async function hasDynamicApplyPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: [ALL_URLS_ORIGIN] });
  } catch {
    return false;
  }
}

async function ensureDynamicApplyPermission(): Promise<boolean> {
  if (await hasDynamicApplyPermission()) return true;
  try {
    return await chrome.permissions.request({ origins: [ALL_URLS_ORIGIN] });
  } catch {
    return false;
  }
}

function looksLikeJobApplicationUrl(url: string): boolean {
  try {
    const u    = new URL(url);
    const path = u.pathname.toLowerCase();
    const qs   = u.search.toLowerCase();
    return (
      // Path-based signals
      path.includes("/apply") ||
      path.includes("/application") ||
      path.includes("/candidate") ||
      path.includes("/career") ||           // /careers, /careers/, /career-portal
      path.includes("/jobs/") ||
      path.includes("/job/") ||
      path.includes("/registration/") ||    // hirist.tech, many Indian portals
      path.includes("/onboard") ||          // instahyre onboarding flow
      path.includes("personaldetail") ||    // hirist.tech /addPersonalDetails
      path.includes("/jobapply") ||
      path.includes("/openings") ||
      // Query-based signals — ATS-specific job ID params
      qs.includes("ashby_jid=") ||          // Ashby embedded on company domains
      qs.includes("gh_jid=") ||             // Greenhouse embedded
      qs.includes("lever_jid=") ||          // Lever embedded
      qs.includes("jobseqno=") ||
      qs.includes("jobid=") ||
      qs.includes("job_id=") ||
      qs.includes("requisitionid=") ||
      qs.includes("jk=") ||
      qs.includes("currentjobid=") ||
      qs.includes("step=") ||
      qs.includes("apply") ||
      // Strongest signal: user arrived via a LinkedIn apply redirect
      qs.includes("source=linkedin") ||
      qs.includes("pref=linkedin") ||
      qs.includes("utm_source=linkedin") ||
      qs.includes("source=reg")             // registration sourced from job apply
    );
  } catch {
    return false;
  }
}

async function maybeInjectDynamicAutofill(tabId: number, url: string): Promise<void> {
  if (!isHttpUrl(url) || isKnownStaticAutofillUrl(url)) return;
  if (!await hasDynamicApplyPermission()) return;

  // Path A: active apply session ties this navigation to a tracked job
  const session = await getApplySessionForBackground();
  const hasActiveSession = !!session
    && session.currentState !== "submitted"
    && session.currentState !== "abandoned"
    && (session.sourceTabId === undefined || session.sourceTabId === tabId);

  // Path B: no session, but the URL strongly suggests a job application form.
  // When the user has granted <all_urls> they want the badge everywhere that
  // looks like an apply page — not just pages reached through tracked jobs.
  const urlIsApplyForm = !hasActiveSession && looksLikeJobApplicationUrl(url);

  if (!hasActiveSession && !urlIsApplyForm) return;

  const injectionKey = `${tabId}:${url}`;
  if (lastDynamicInjection.get(tabId) === injectionKey) return;
  lastDynamicInjection.set(tabId, injectionKey);

  try {
    const script = getPackagedAutofillScript();
    if (!script) return;

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [script],
    });
    await patchApplySessionForBackground({
      currentState: "redirecting",
      currentPortal: new URL(url).hostname,
      currentUrl: url,
    });
    pushTelemetryEvent({
      event: "dynamic_autofill_injected",
      timestamp: new Date().toISOString(),
      tabId,
      url,
    });
  } catch {
    // Dynamic injection is best-effort. Static known-host content scripts and
    // manual extension flows remain untouched if this fails.
  }
}

function getPackagedAutofillScript(): string | null {
  try {
    const manifest = chrome.runtime.getManifest();
    const contentScripts = manifest.content_scripts ?? [];
    const autofill = contentScripts.find((script) =>
      script.matches?.includes("http://localhost:3000/demo-apply*"),
    );
    return autofill?.js?.[0] ?? null;
  } catch {
    return null;
  }
}

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0 || !details.url) return;
  void maybeInjectDynamicAutofill(details.tabId, details.url);
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0 || !details.url) return;
  void maybeInjectDynamicAutofill(details.tabId, details.url);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  lastDynamicInjection.delete(tabId);
  void (async () => {
    const session = await getApplySessionForBackground();
    if (session?.sourceTabId === tabId) {
      await chrome.storage.session.remove(APPLY_SESSION_KEY);
    }
  })();
});

// ── Notification helpers ──────────────────────────────────────────────────────

async function pushNotification(
  n: Omit<AppNotification, "id" | "timestamp" | "read">,
): Promise<void> {
  const result = await chrome.storage.local.get("af_notifications");
  // S-05 fix: guard against storage corruption — af_notifications must be an array.
  // A plain object or other type would cause [...corruptValue] to throw TypeError.
  const stored = result["af_notifications"];
  const list: AppNotification[] = Array.isArray(stored) ? stored : [];
  const next: AppNotification[] = [
    { ...n, id: crypto.randomUUID(), timestamp: new Date().toISOString(), read: false },
    ...list,
  ].slice(0, 20);
  await chrome.storage.local.set({ af_notifications: next });
  // Don't set extension badge count — notifications live in the web app bell now
  await chrome.action.setBadgeText({ text: "" });

  // Push to backend so the web app bell shows it — fire-and-forget
  void pushNotificationToApi(n);
}

async function pushNotificationToApi(
  n: Omit<AppNotification, "id" | "timestamp" | "read">,
): Promise<void> {
  try {
    const token = await getToken();
    if (!token) return;
    await fetch(`${API_BASE}/api/v1/notifications/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: n.type, title: n.title, body: n.body }),
    });
  } catch { /* fire-and-forget — web app is optional */ }
}

async function markAllRead(): Promise<void> {
  const result = await chrome.storage.local.get("af_notifications");
  const stored2 = result["af_notifications"];
  const list: AppNotification[] = Array.isArray(stored2) ? stored2 : [];
  await chrome.storage.local.set({
    af_notifications: list.map(n => ({ ...n, read: true })),
  });
  await chrome.action.setBadgeText({ text: "" });
}

async function getToken(): Promise<string | null> {
  const result = await chrome.storage.local.get("session");
  return (result["session"] as { token?: string } | null)?.token ?? null;
}

async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    // Token expired or invalid — wipe it so the popup shows the login screen
    await chrome.storage.local.remove("session");
  }
  return res;
}

async function analyzeJob(payload: LinkedInJobData) {
  try {
    const res = await authedFetch(`${API_BASE}/api/v1/ai/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_title: payload.title,
        company: payload.company,
        description: payload.description,
        url: payload.url,
      }),
    });
    return await res.json();
  } catch {
    return { error: "API unavailable" };
  }
}

async function openTailorTab(payload: { jd: string; company: string; role: string; applicationId?: string }) {
  if (!await getToken()) throw new Error("Not authenticated");
  await chrome.storage.local.set({ af_tailor_prefill: payload });
  await chrome.tabs.create({ url: `${WEB_BASE}/resume` });
}

async function openResumeTab(payload: { resumeId: string; applicationId: string }) {
  if (!await getToken()) throw new Error("Not authenticated");
  await chrome.storage.local.set({ af_open_resume: payload });
  await chrome.tabs.create({ url: `${WEB_BASE}/resume` });
}

async function lookupByUrl(payload: { url: string; fingerprintHash?: string }) {
  try {
    if (!await getToken()) return null;
    // Prefer fingerprint lookup (survives URL changes/reposts); fall back to raw URL.
    const params = new URLSearchParams({ url: payload.url });
    if (payload.fingerprintHash) params.set("fingerprint_hash", payload.fingerprintHash);
    const res = await authedFetch(`${API_BASE}/api/v1/applications/lookup?${params.toString()}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function checkApplication(payload: { company: string; role: string }) {
  try {
    const token = await getToken();
    if (!token) return null;
    const params = new URLSearchParams({ company: payload.company, role: payload.role });
    const res = await fetch(`${API_BASE}/api/v1/applications/check?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function updateAppStatus(payload: { id: string; status: string; atsMetadata?: Record<string, unknown> }) {
  try {
    if (!await getToken()) return { error: "AUTH_REQUIRED" };
    const body: Record<string, unknown> = { status: payload.status };
    if (payload.atsMetadata) body.ats_metadata = payload.atsMetadata;
    const res = await authedFetch(`${API_BASE}/api/v1/applications/${payload.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { error: "AUTH_REQUIRED" };
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: (err as { detail?: string }).detail ?? `HTTP ${res.status}` };
    }
    const data = await res.json() as { company?: string; role?: string; status?: string };
    const LABELS: Record<string, string> = {
      applied: "Applied", interview: "Interview", technical: "Interview", offer: "Offer",
    };
    if (data.status && LABELS[data.status]) {
      void pushNotification({
        type: "success",
        title: `Moved to ${LABELS[data.status]}`,
        body: `${data.company ?? ""} · ${data.role ?? ""}`.trim(),
      });
    }
    return { success: true, data };
  } catch {
    return { error: "API unavailable — is the server running?" };
  }
}

async function getMatches(payload: { fields: unknown[]; url: string; job_context?: string }) {
  try {
    if (!await getToken()) return { error: "Not signed in" };
    const res = await authedFetch(`${API_BASE}/api/v1/autofill/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: payload.fields,
        url: payload.url,
        job_context: payload.job_context ?? "",
      }),
    });
    if (!res.ok) return { error: `API error ${res.status}` };
    return await res.json();
  } catch {
    return { error: "API unavailable" };
  }
}

async function smartMatch(payload: { fields: unknown[]; url: string; job_context?: string }) {
  try {
    if (!await getToken()) return { error: "Not signed in" };
    const res = await authedFetch(`${API_BASE}/api/v1/autofill/smart-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: payload.fields,
        url: payload.url,
        job_context: payload.job_context ?? "",
      }),
    });
    if (!res.ok) return { error: `API error ${res.status}` };
    return await res.json();
  } catch {
    return { error: "API unavailable" };
  }
}

async function getProfile() {
  try {
    if (!await getToken()) return null;
    const res = await authedFetch(`${API_BASE}/api/v1/profile/`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function saveLearnedFields(payload: { fields: Record<string, string> }) {
  try {
    if (!await getToken()) return { ok: false };
    const res = await authedFetch(`${API_BASE}/api/v1/profile/learned-fields`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

async function extractJobAi(payload: { pageText: string; url: string; portal?: string }) {
  try {
    if (!await getToken()) return null;
    const res = await authedFetch(`${API_BASE}/api/v1/ai/extract-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page_text: payload.pageText,
        url: payload.url,
        portal: payload.portal ?? null,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function recordObservation(payload: {
  applicationId: string;
  extractionMethod: string;
  portal?: string;
  isLive?: boolean;
  signals?: Record<string, unknown>;
}) {
  try {
    if (!await getToken()) return;
    await authedFetch(`${API_BASE}/api/v1/observations/${payload.applicationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        extraction_method: payload.extractionMethod,
        portal: payload.portal ?? null,
        is_live: payload.isLive ?? true,
        signals: payload.signals ?? null,
      }),
    });
  } catch {
    // fire-and-forget — don't surface errors to the content script
  }
}

async function getResumePdfBytes(resumeId: string) {
  try {
    if (!await getToken()) return null;
    const res = await authedFetch(`${API_BASE}/api/v1/resumes/${resumeId}/pdf-bytes`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function syncApplication(payload: {
  jobData: LinkedInJobData;
  status: string;
  fingerprintHash?: string;
  portal?: string;
  canonicalUrl?: string;
  externalJobId?: string;
}) {
  try {
    if (!await getToken()) {
      return { error: "AUTH_REQUIRED" };
    }
    const res = await authedFetch(`${API_BASE}/api/v1/applications/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: payload.jobData.company,
        role: payload.jobData.title,
        job_url: payload.jobData.url,
        job_description: payload.jobData.description,
        status: payload.status,
        fingerprint_hash: payload.fingerprintHash,
        portal: payload.portal,
        canonical_url: payload.canonicalUrl,
        external_job_id: payload.externalJobId,
      }),
    });
    if (res.status === 401) return { error: "AUTH_REQUIRED" };
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: (err as { detail?: string }).detail ?? `HTTP ${res.status}` };
    }
    const data = await res.json() as { id?: string };
    void pushNotification({
      type: "success",
      title: "Job tracked!",
      body: `${payload.jobData.company} · ${payload.jobData.title}`,
    });
    return { success: true, data };
  } catch {
    return { error: "API unavailable — is the server running?" };
  }
}

// ── Field regeneration ────────────────────────────────────────────────────────

async function regenerateField(payload: {
  uid: string; kind: string; label: string;
  current_value?: string; url?: string; page_text?: string;
}) {
  try {
    if (!await getToken()) return { error: "AUTH_REQUIRED" };
    const res = await authedFetch(`${API_BASE}/api/v1/autofill/regenerate-field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  } catch {
    return { error: "API unavailable" };
  }
}

// ── Auth (called from content scripts — avoids CORS) ─────────────────────────

async function authLogin(payload: { email: string; password: string }) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.detail ?? "Invalid email or password" };
    return { ok: true, data };
  } catch {
    return { error: "Could not connect to server" };
  }
}

// ── Manual tracking ──────────────────────────────────────────────────────────

async function getRecentApps() {
  try {
    if (!await getToken()) return null;
    const res = await authedFetch(`${API_BASE}/api/v1/applications/?limit=8`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function quickTrack(
  payload: { company: string; role: string; url?: string },
  fromTabId?: number,
): Promise<{ success?: boolean; data?: { id: string }; error?: string }> {
  try {
    if (!await getToken()) return { error: "Not signed in" };

    // Resolve URL: caller may pass it, otherwise read from the originating tab
    let url = payload.url ?? "";
    if (!url && fromTabId !== undefined) {
      const tab = await chrome.tabs.get(fromTabId).catch(() => null);
      url = tab?.url ?? "";
    }

    const res = await authedFetch(`${API_BASE}/api/v1/applications/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: payload.company,
        role: payload.role,
        job_url: url || null,
        status: "saved",
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: (err as { detail?: string }).detail ?? `HTTP ${res.status}` };
    }
    const data = await res.json() as { id?: string };
    void pushNotification({
      type: "success",
      title: "Job tracked!",
      body: `${payload.company} · ${payload.role} — marked Applied`,
    });
    return { success: true, data: data as { id: string } };
  } catch {
    return { error: "API unavailable — is the server running?" };
  }
}

// ── Telemetry batch ───────────────────────────────────────────────────────────
// Events accumulate in memory. When a backend telemetry endpoint is added
// (Sprint 4), this buffer will be flushed periodically. Until then, events
// are available in-memory for debugging.
const MAX_TELEMETRY_BATCH = 100;
const _telemetryBatch: Record<string, unknown>[] = [];

function pushTelemetryEvent(event: Record<string, unknown>): void {
  _telemetryBatch.push(event);
  // Rolling window — drop oldest when buffer fills
  if (_telemetryBatch.length > MAX_TELEMETRY_BATCH) {
    _telemetryBatch.shift();
  }
}
