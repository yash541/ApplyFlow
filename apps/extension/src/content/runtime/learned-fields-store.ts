/**
 * Local-first learned fields store.
 *
 * Save: writes to chrome.storage.local immediately (never fails) then
 *       fires a best-effort backend sync so the server stays in sync.
 *
 * Match: two-tier lookup —
 *   1. Semantic normalization: "given name", "forename", "first name*" all
 *      resolve to the canonical key "first_name" and match the same saved value.
 *      This makes learned fields portable across every job site.
 *   2. Raw-label fallback: site-specific fields ("expected ctc", "notice period")
 *      are stored verbatim and matched exactly on the same site.
 */

const STORE_KEY = "af_learned_fields";

/** Canonical key → value */
export type LearnedFields = Record<string, string>;

// Mirror of the backend's _LABEL_TO_KEY — keeps extension and server in sync.
const LABEL_TO_SEMANTIC: Record<string, string> = {
  // Name
  "first name":          "first_name",
  "given name":          "first_name",
  "forename":            "first_name",
  "legal first name":    "first_name",
  "last name":           "last_name",
  "surname":             "last_name",
  "family name":         "last_name",
  "legal last name":     "last_name",
  "middle name":         "middle_name",
  "full name":           "full_name",
  "your name":           "full_name",
  "applicant name":      "full_name",
  "legal name":          "full_name",
  "name":                "full_name",
  // Contact
  "email":               "email",
  "email address":       "email",
  "email id":            "email",
  "work email":          "email",
  "phone":               "phone",
  "phone number":        "phone",
  "mobile":              "phone",
  "mobile number":       "phone",
  "mobile phone number": "phone",
  "cell number":         "phone",
  "contact number":      "phone",
  "telephone":           "phone",
  "whatsapp":            "phone",
  // Online presence
  "linkedin":            "linkedin",
  "linkedin url":        "linkedin",
  "linkedin profile":    "linkedin",
  "linkedin profile url":"linkedin",
  "github":              "github",
  "github url":          "github",
  "github profile":      "github",
  "website":             "website",
  "portfolio":           "website",
  "personal url":        "website",
  "homepage":            "website",
  "personal website":    "website",
  // Location
  "location":            "location",
  "current location":    "location",
  "present location":    "location",
  "address":             "location",
  "city":                "city",
  "state":               "state",
  "country":             "country",
  "zip":                 "zip",
  "postal code":         "zip",
  "pin code":            "zip",
  // Profile
  "headline":            "headline",
  "current title":       "headline",
  "designation":         "headline",
  "job title":           "headline",
  "summary":             "summary",
  "tell us about yourself": "summary",
  "about yourself":      "summary",
  "introduce yourself":  "summary",
  "cover letter":        "summary",
};

/**
 * Normalise a form label to its canonical key.
 * Strips trailing * / whitespace, lowercases, then checks the semantic map.
 * Falls back to the cleaned raw label for site-specific fields.
 */
export function normalizeLabel(label: string): string {
  const cleaned = label
    .replace(/[*]+/g, "")          // strip asterisks (required-field marker)
    .replace(/\s+/g, " ")          // collapse whitespace
    .trim()
    .toLowerCase();
  return LABEL_TO_SEMANTIC[cleaned] ?? cleaned;
}

/** Load all learned fields from local storage. */
export function loadLearnedFields(): Promise<LearnedFields> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(STORE_KEY, (r) => {
        resolve((r[STORE_KEY] as LearnedFields) ?? {});
      });
    } catch {
      resolve({});
    }
  });
}

/**
 * Save learned fields — local-first.
 * Writes to chrome.storage.local synchronously then fires a background
 * sync to the backend (best-effort; never blocks the caller).
 */
export function persistLearnedFields(
  fields: Record<string, string>,
  bgSync = true,
): void {
  chrome.storage.local.get(STORE_KEY, (r) => {
    const existing = (r[STORE_KEY] as LearnedFields) ?? {};
    const toAdd: LearnedFields = {};
    for (const [label, value] of Object.entries(fields)) {
      if (label.trim() && value.trim()) {
        toAdd[normalizeLabel(label)] = value.trim();
      }
    }
    chrome.storage.local.set({ [STORE_KEY]: { ...existing, ...toAdd } });
  });

  // Best-effort backend sync — failure is acceptable, local is source of truth
  if (bgSync) {
    try {
      chrome.runtime.sendMessage({
        type: "SAVE_LEARNED_FIELDS",
        payload: { fields },
      });
    } catch { /* extension context may be stale on older tabs */ }
  }
}

/**
 * Look up a saved value for a form field label.
 * Returns undefined if no learned value exists.
 */
export function matchLearnedField(
  label: string,
  learned: LearnedFields,
): string | undefined {
  if (!label.trim()) return undefined;
  const key = normalizeLabel(label);
  return learned[key];
}

/**
 * Build pre-answered SmartAnswer objects for fields that have a learned match.
 * Call this before opening the review sidebar so learned answers appear
 * instantly without waiting for the AI stream.
 */
export function buildLearnedAnswers(
  fields: { uid: string; question: string }[],
  learned: LearnedFields,
): import("@applyflow/shared").SmartAnswer[] {
  const answers: import("@applyflow/shared").SmartAnswer[] = [];
  for (const f of fields) {
    const value = matchLearnedField(f.question, learned);
    if (value) {
      answers.push({ uid: f.uid, answer: value, confidence: "high", skipped: false });
    }
  }
  return answers;
}
