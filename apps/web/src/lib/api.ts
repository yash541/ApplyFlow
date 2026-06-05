const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("af_token") : null;
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    const msg =
      typeof detail === "string"  ? detail :
      Array.isArray(detail)       ? detail.map((e: { msg?: string }) => e.msg ?? String(e)).join(", ") :
      typeof detail === "object" && detail !== null && "code" in detail
                                  ? String((detail as Record<string, unknown>).code)
                                  : "Request failed";
    // Attach HTTP status so callers can distinguish 402 Payment Required etc.
    const error = new Error(msg) as Error & { status: number };
    error.status = res.status;
    throw error;
  }
  return res.json() as Promise<T>;
}

// ── Billing types ─────────────────────────────────────────────────────────────

export interface UsageData {
  plan: "free" | "pro" | "expired";
  autofill_used: number;
  autofill_limit: number | null;  // null = unlimited (pro)
  score_used: number;
  score_limit: number | null;
  tailor_used: number;
  tailor_limit: number | null;
  downloads_used: number;
  downloads_limit: number | null;
}

// ── Shared types ─────────────────────────────────────────────────────────────

export interface WorkEntry {
  title: string;
  company: string;
  duration: string;
  current: boolean;
  bullets: string[];
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year: string;
}

export interface MasterProfileData {
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  website: string;
  headline: string;
  summary: string;
  experience: WorkEntry[];
  education: EducationEntry[];
  skills: string[];
  work_authorization: string;
  requires_sponsorship: boolean;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  willing_to_relocate: boolean;
  relocation_details: string;
  remote_preference: string;
  notice_period: string;
  years_experience: number | null;
  gender: string;
  ethnicity: string;
  disability_status: string;
  veteran_status: string;
}

export interface MasterProfile {
  name: string;
  email: string;
  data: MasterProfileData;
}



export interface ResumeData {
  id: string;
  type: "base" | "tailored";
  name: string;                    // resolved display name (filename or auto-generated)
  filename: string | null;
  ats_score: number | null;
  application_id: string | null;
  edit_count: number;
  downloaded: boolean;
  created_at: string;
  updated_at: string;
  // Only present on detail endpoints
  content?: string | null;
  tailored_content?: Record<string, unknown> | null;
}

export interface ApplicationData {
  id: string;
  company: string;
  role: string;
  job_url: string | null;
  status: string;
  notes: string | null;
  has_resume: boolean;
  resume_id: string | null;
  ats_score: number | null;
  applied_at: string;
  updated_at: string;
  // Only present on detail endpoint
  job_description?: string | null;
}

// ── API client ────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ access_token: string; user: { id: string; name: string; email: string } }>(
        "/api/v1/auth/login",
        { method: "POST", body: { email, password } },
      ),
    register: (name: string, email: string, password: string) =>
      request<{ access_token: string; user: { id: string; name: string; email: string } }>(
        "/api/v1/auth/register",
        { method: "POST", body: { name, email, password } },
      ),
    me: () =>
      request<{ id: string; name: string; email: string }>("/api/v1/auth/me"),
  },

  resumes: {
    list: () =>
      request<{ resumes: ResumeData[] }>("/api/v1/resumes/"),

    getBase: () =>
      request<ResumeData>("/api/v1/resumes/base"),

    get: (id: string) =>
      request<ResumeData>(`/api/v1/resumes/${id}`),

    upload: async (file: File): Promise<ResumeData> => {
      const token = getToken();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/api/v1/resumes/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Upload failed");
      }
      return res.json() as Promise<ResumeData>;
    },

    saveTailored: (data: {
      application_id?: string | null;
      name?: string;
      tailored_content: Record<string, unknown>;
      pdf_bytes?: string;
    }) =>
      request<ResumeData>("/api/v1/resumes/tailored", { method: "POST", body: data }),

    update: (id: string, data: { tailored_content?: Record<string, unknown>; name?: string; pdf_bytes?: string }) =>
      request<ResumeData>(`/api/v1/resumes/${id}`, { method: "PUT", body: data }),

    getPdfBytes: (id: string) =>
      request<{ pdf_bytes: string | null }>(`/api/v1/resumes/${id}/pdf-bytes`),

    delete: (id: string) =>
      request<{ deleted: string }>(`/api/v1/resumes/${id}`, { method: "DELETE" }),
  },

  profile: {
    get: () =>
      request<MasterProfile>("/api/v1/profile/"),
    update: (data: MasterProfileData) =>
      request<MasterProfile>("/api/v1/profile/", { method: "PUT", body: { data } }),
    updateName: (name: string) =>
      request<{ name: string }>("/api/v1/profile/name", { method: "PUT", body: { name } }),
    importFromResume: (resumeId?: string) =>
      request<{ data: MasterProfileData; resume_name: string }>(
        "/api/v1/profile/import-resume",
        { method: "POST", body: resumeId ? { resume_id: resumeId } : {} },
      ),
  },

  applications: {
    list: () =>
      request<{ applications: ApplicationData[] }>("/api/v1/applications/"),

    get: (id: string) =>
      request<ApplicationData>(`/api/v1/applications/${id}`),

    lookup: (url: string) =>
      request<ApplicationData | null>(`/api/v1/applications/lookup?url=${encodeURIComponent(url)}`),

    create: (data: {
      company: string;
      role: string;
      job_url?: string;
      job_description?: string;
      notes?: string;
      status?: string;
    }) =>
      request<ApplicationData>("/api/v1/applications/", { method: "POST", body: data }),

    update: (id: string, data: {
      company?: string;
      role?: string;
      status?: string;
      job_url?: string;
      job_description?: string;
      notes?: string;
    }) =>
      request<ApplicationData>(`/api/v1/applications/${id}`, { method: "PATCH", body: data }),

    /** @deprecated use update() instead */
    updateStatus: (id: string, status: string) =>
      request<ApplicationData>(`/api/v1/applications/${id}`, { method: "PATCH", body: { status } }),

    delete: (id: string) =>
      request<{ deleted: string }>(`/api/v1/applications/${id}`, { method: "DELETE" }),
  },

  billing: {
    getUsage: () =>
      request<UsageData>("/api/v1/billing/usage"),

    createCheckout: (priceId: string) =>
      request<{ url: string }>("/api/v1/billing/checkout", {
        method: "POST",
        body: {
          price_id: priceId,
          success_url: `${typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000")}/dashboard?upgraded=true`,
          cancel_url: `${typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000")}/dashboard`,
        },
      }),

    createPortal: () =>
      request<{ url: string }>("/api/v1/billing/portal", { method: "POST" }),

    syncPlan: () =>
      request<{ plan: string; synced: boolean }>("/api/v1/billing/sync-plan", { method: "POST" }),
  },

  jobs: {
    searchFast: (q: string, location = "", filters: { date_posted?: string; job_type?: string; remote_only?: boolean; country?: string; providers?: string[] } = {}) =>
      request<{
        jobs: import("@/components/jobs/JobsPage").Job[];
        provider_stats: Record<string, { status: "ok" | "error"; count: number; error: string | null }>;
        duplicates_removed: number;
        total_before_dedup: number;
        providers: string[];
      }>(
        `/api/v1/jobs/search/fast?q=${encodeURIComponent(q)}&location=${encodeURIComponent(location)}&date_posted=${filters.date_posted ?? "week"}&job_type=${filters.job_type ?? ""}&remote_only=${filters.remote_only ?? false}&country=${filters.country ?? "in"}&providers=${(filters.providers ?? []).join(",")}`,
        { method: "POST" },
      ),
    apifyStart: (q: string, location = "", filters: { remote_only?: boolean; country?: string } = {}) =>
      request<{ runs: { run_id?: string; dataset_id?: string; actor?: string; label?: string; error?: string }[] }>(
        `/api/v1/jobs/search/apify/start?q=${encodeURIComponent(q)}&location=${encodeURIComponent(location)}&remote_only=${filters.remote_only ?? false}&country=${filters.country ?? "in"}`,
        { method: "POST" },
      ),
    apifyPoll: (run_id: string, dataset_id: string, actor: string, label = "") =>
      request<{ status: string; jobs: import("@/components/jobs/JobsPage").Job[]; raw_count?: number; duplicates_removed?: number; label?: string }>(
        `/api/v1/jobs/search/apify/results?run_id=${encodeURIComponent(run_id)}&dataset_id=${encodeURIComponent(dataset_id)}&actor=${encodeURIComponent(actor)}&label=${encodeURIComponent(label)}`,
      ),
    apifySchema: (actor_id: string) =>
      request<{
        actor: string; is_task: boolean; actor_name: string; description: string;
        input_fields: { name: string; type: string; description: string; default: unknown; required: boolean; enum?: string[] }[];
        suggested_mappings: Record<string, string | null>;
      }>(`/api/v1/jobs/apify/schema?actor_id=${encodeURIComponent(actor_id)}`),

    apifyMapOutput: (actor_id: string, sample_item: Record<string, unknown>) =>
      request<{ mapping: Record<string, string | null>; confidence: Record<string, string> }>(
        "/api/v1/jobs/apify/map-output",
        { method: "POST", body: { actor_id, sample_item } },
      ),

    apifyTest: (actor_id: string, q = "software engineer") =>
      request<{ ok: boolean; raw: Record<string, unknown>; mapped: import("@/components/jobs/JobsPage").Job; total: number; actor: string; warning?: string }>(
        `/api/v1/jobs/apify/test?actor_id=${encodeURIComponent(actor_id)}&q=${encodeURIComponent(q)}`,
        { method: "POST" },
      ),
    getConfigs: () =>
      request<{ configs: { provider: string; enabled: boolean; configured: boolean; key_preview: string; app_id: string; actor_id: string; actors?: { id?: string; label?: string; actor_id?: string; enabled?: boolean }[] }[] }>(
        "/api/v1/jobs/api-configs",
      ),
    saveConfigs: (configs: { provider: string; key: string; app_id?: string; actor_id?: string; enabled?: boolean }[]) =>
      request<{ ok: boolean }>("/api/v1/jobs/api-configs", { method: "PUT", body: { configs } }),
    // Legacy compat
    getConfig: () =>
      request<{ configured: boolean; provider?: string; key_preview?: string; app_id?: string }>(
        "/api/v1/jobs/api-config",
      ),
    saveConfig: (cfg: { provider: string; key: string; app_id?: string; actor_id?: string }) =>
      request<{ ok: boolean }>("/api/v1/jobs/api-config", { method: "PUT", body: cfg }),
  },
};

// ── SSE streaming helpers ─────────────────────────────────────────────────────

async function* parseSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const { chunk } = JSON.parse(data) as { chunk: string };
        if (chunk) yield chunk;
      } catch {
        // skip malformed lines
      }
    }
  }
}

export async function rewriteBullet(params: {
  bullet: string;
  jobDescription?: string;
  role?: string;
}): Promise<string> {
  const data = await request<{ bullet: string }>("/api/v1/ai/rewrite-bullet", {
    method: "POST",
    body: {
      bullet: params.bullet,
      job_description: params.jobDescription ?? "",
      role: params.role ?? "",
    },
  });
  return data.bullet;
}

export async function* streamChat(message: string): AsyncGenerator<string> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
  });
  if (!res.ok || !res.body) throw new Error("Chat request failed");
  yield* parseSSEStream(res.body);
}

export async function* streamTailor(params: {
  resumeId?: string;
  resumeText?: string;
  applicationId?: string;
  jobDescription?: string;
}): AsyncGenerator<string> {
  const token = getToken();
  const body: Record<string, string> = {};
  if (params.resumeId) body.resume_id = params.resumeId;
  if (params.resumeText) body.resume_text = params.resumeText;
  if (params.applicationId) body.application_id = params.applicationId;
  if (params.jobDescription) body.job_description = params.jobDescription;

  const res = await fetch(`${API_URL}/api/v1/ai/tailor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error("Tailor request failed");
  yield* parseSSEStream(res.body);
}
