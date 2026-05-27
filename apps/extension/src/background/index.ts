import type { ExtensionMessage, LinkedInJobData, AppNotification } from "@applyflow/shared";

const API_BASE = "http://localhost:8000";
const WEB_BASE = "http://localhost:3000";

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
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
  },
);

// ── Notification helpers ──────────────────────────────────────────────────────

async function pushNotification(
  n: Omit<AppNotification, "id" | "timestamp" | "read">,
): Promise<void> {
  const result = await chrome.storage.local.get("af_notifications");
  const list = (result["af_notifications"] ?? []) as AppNotification[];
  const next: AppNotification[] = [
    { ...n, id: crypto.randomUUID(), timestamp: new Date().toISOString(), read: false },
    ...list,
  ].slice(0, 20);
  await chrome.storage.local.set({ af_notifications: next });
  const unread = next.filter(item => !item.read).length;
  await chrome.action.setBadgeText({ text: unread > 0 ? String(unread) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
}

async function markAllRead(): Promise<void> {
  const result = await chrome.storage.local.get("af_notifications");
  const list = (result["af_notifications"] ?? []) as AppNotification[];
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
    if (!await getToken()) return { error: "Please sign in via the ApplyFlow popup." };
    const body: Record<string, unknown> = { status: payload.status };
    if (payload.atsMetadata) body.ats_metadata = payload.atsMetadata;
    const res = await authedFetch(`${API_BASE}/api/v1/applications/${payload.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { error: "Session expired — please sign in again." };
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
      return { error: "Not logged in — please sign in via the ApplyFlow popup." };
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
    if (res.status === 401) return { error: "Session expired — please sign in again via the ApplyFlow popup." };
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
