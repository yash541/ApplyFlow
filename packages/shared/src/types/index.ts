// ─── User & Auth ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  plan: "free" | "pro" | "enterprise";
  createdAt: string;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: string;
}

// ─── Resume ───────────────────────────────────────────────────────────────────

export interface Resume {
  id: string;
  userId: string;
  name: string;
  content: string;       // raw text / markdown
  parsedData: ParsedResume;
  embeddings?: number[]; // vector embedding
  atsScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedResume {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  summary?: string;
  experience: WorkExperience[];
  education: Education[];
  skills: string[];
  certifications?: string[];
}

export interface WorkExperience {
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  bullets: string[];
  location?: string;
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate?: string;
  gpa?: number;
}

// ─── Job Application ─────────────────────────────────────────────────────────

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "screening"
  | "interview"
  | "technical"
  | "offer"
  | "rejected"
  | "withdrawn";

export interface JobApplication {
  id: string;
  userId: string;
  jobTitle: string;
  company: string;
  location?: string;
  jobUrl?: string;
  jobDescription?: string;
  status: ApplicationStatus;
  matchScore?: number;       // 0–100 AI match score
  appliedAt?: string;
  notes?: string;
  resumeId?: string;
  salary?: SalaryRange;
  contacts?: Contact[];
  interviews?: Interview[];
  createdAt: string;
  updatedAt: string;
}

export interface SalaryRange {
  min: number;
  max: number;
  currency: string;
}

export interface Contact {
  name: string;
  title?: string;
  email?: string;
  linkedInUrl?: string;
}

export interface Interview {
  id: string;
  type: "phone" | "video" | "onsite" | "technical" | "behavioral";
  scheduledAt: string;
  notes?: string;
  completed: boolean;
  feedback?: string;
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────

export interface JobMatchAnalysis {
  jobId: string;
  resumeId: string;
  overallScore: number;         // 0–100
  skillMatch: number;
  experienceMatch: number;
  educationMatch: number;
  keywordMatch: number;
  missingKeywords: string[];
  matchingKeywords: string[];
  suggestions: AISuggestion[];
  tailoredBullets?: TailoredBullet[];
}

export interface AISuggestion {
  type: "keyword" | "bullet" | "summary" | "skill" | "format";
  priority: "high" | "medium" | "low";
  original?: string;
  suggested: string;
  reason: string;
}

export interface TailoredBullet {
  original: string;
  tailored: string;
  improvement: string;
}

// ─── AI Chat ──────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  context?: "resume" | "interview" | "salary" | "general";
  createdAt: string;
}

// ─── Autofill (smart scrape) ──────────────────────────────────────────────────

/**
 * One form field as scraped from the page.
 * The detector does NOT classify or guess answers — only the question text
 * and available choices are extracted. Claude answers them all.
 */
export interface ScrapedField {
  uid: string;
  question: string;    // visible label / heading near the field
  fieldType: string;   // "text" | "email" | "tel" | "textarea" | "radio" | "select" | "file"
  options: string[];   // choices for radio/select, empty for free-text
  selector: string;    // CSS selector used to fill the element
}

/** Claude's answer for one field, returned by /autofill/smart-match. */
export interface SmartAnswer {
  uid: string;
  answer: string;
  confidence: "high" | "medium" | "low";
  skipped?: boolean;
}

// ─── Autofill (legacy classification) ────────────────────────────────────────

export type FieldKind =
  | "full_name" | "first_name" | "last_name"
  | "email" | "phone"
  | "location" | "city" | "state" | "country" | "zip"
  | "linkedin" | "github" | "website"
  | "headline" | "summary"
  | "work_auth" | "requires_sponsorship"
  | "salary" | "years_experience" | "notice_period"
  | "remote_preference" | "willing_to_relocate"
  | "gender" | "ethnicity" | "disability" | "veteran"
  | "resume_file"
  | "unknown";

export interface DetectedField {
  uid: string;
  kind: FieldKind;
  confidence: number;   // 0–1
  inputType: string;    // "text" | "email" | "tel" | "file" | "select" | "textarea" | …
  label: string;        // best label text found
  selector: string;     // CSS selector to re-find the element
}

export type MatchSource = "rules" | "ai" | "none";

export interface FieldMatch {
  uid: string;
  kind: FieldKind;
  value: string | null;
  source: MatchSource;
  confidence: number;
}

// ─── Extension ────────────────────────────────────────────────────────────────

export interface LinkedInJobData {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  salary?: string;
  jobType?: string;
  postedAt?: string;
}

export type NotificationType = "success" | "error" | "info" | "warning";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  action?: {
    label: string;
    resumeId?: string;
    applicationId?: string;
  };
  timestamp: string;
  read: boolean;
}

export interface ExtensionMessage {
  type:
    | "ANALYZE_JOB"
    | "AUTOFILL_FORM"
    | "GET_SESSION"
    | "GET_PROFILE"
    | "GET_MATCHES"
    | "GET_RESUME_PDF"
    | "SYNC_APPLICATION"
    | "CHECK_APPLICATION"
    | "LOOKUP_BY_URL"
    | "UPDATE_APP_STATUS"
    | "OPEN_TAILOR"
    | "OPEN_RESUME"
    | "MATCH_RESULT"
    | "NOTIFY"
    | "MARK_NOTIFICATIONS_READ"
    | "SAVE_LEARNED_FIELDS"
    | "EXTRACT_JOB_AI"
    | "RECORD_OBSERVATION"
    | "APPLY_SESSION_STARTED"
    | "ENSURE_DYNAMIC_APPLY_PERMISSION"
    | "TELEMETRY"
    | "GET_RECENT_APPS"
    | "QUICK_TRACK"
    | "SMART_MATCH"
    | "FIELD_ANSWER"
    | "SMART_MATCH_DONE"
    | "REGENERATE_FIELD"
    | "AUTH_LOGIN"
    | "OPEN_LOGIN";
  payload?: unknown;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
