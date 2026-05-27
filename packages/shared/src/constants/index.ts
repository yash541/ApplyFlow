export const APP_NAME = "ApplyFlow AI";
export const APP_VERSION = "0.1.0";

export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "screening",
  "interview",
  "technical",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  technical: "Technical",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const STATUS_COLORS: Record<string, string> = {
  saved: "#8c9aaa",
  applied: "#b0c6ff",
  screening: "#d0bcff",
  interview: "#fcd34d",
  technical: "#6ee7b7",
  offer: "#34d399",
  rejected: "#ffb4ab",
  withdrawn: "#6b7280",
};

export const AI_MODELS = {
  FAST: "claude-haiku-4-5-20251001",
  BALANCED: "claude-sonnet-4-6",
  POWERFUL: "claude-opus-4-7",
} as const;

export const MATCH_SCORE_TIERS = {
  EXCELLENT: { min: 85, label: "Excellent Match", color: "#6ee7b7" },
  GOOD: { min: 70, label: "Good Match", color: "#b0c6ff" },
  FAIR: { min: 50, label: "Fair Match", color: "#fcd34d" },
  POOR: { min: 0, label: "Poor Match", color: "#ffb4ab" },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = ((globalThis as Record<string, unknown>)["process"] as { env?: Record<string, string | undefined> } | undefined)?.env ?? {};

export const API_BASE_URL = _env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000";
export const WS_URL = _env["NEXT_PUBLIC_WS_URL"] ?? "ws://localhost:8000/ws";
