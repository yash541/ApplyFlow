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
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
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
      application_id: string;
      tailored_content: Record<string, unknown>;
      name?: string;
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
