import type { LinkedInJobData } from "@applyflow/shared";

export type JobFingerprint = {
  /** Lowercase portal identifier, e.g. "greenhouse", "linkedin". */
  portal: string;
  /** Job URL with tracking params stripped. */
  canonicalUrl: string;
  /** ATS-native job ID extracted from the URL (most stable identifier). */
  externalJobId?: string;
  normalizedCompany: string;
  normalizedTitle: string;
  normalizedLocation?: string;
  /** SHA-256 hex string. Priority: externalJobId > company+title+location > canonicalUrl. */
  hash: string;
};

// ── Normalization ─────────────────────────────────────────────────────────────

const COMPANY_NOISE = /\b(inc\.?|llc\.?|ltd\.?|co\.?|corp\.?|limited|incorporated)\b/gi;
const TITLE_SENIORITY = /\b(senior|sr\.?|junior|jr\.?|staff|principal|lead|associate|mid[\s-]?level|entry[\s-]?level)\b/gi;
const TITLE_LEVEL_SUFFIX = /\s+(i{1,3}|iv|v|[1-5])\s*$/i;
const PUNCT = /[^\w\s]/g;
const MULTI_SPACE = /\s+/g;

export function normalizeCompany(raw: string): string {
  return raw
    .replace(/^the\s+/i, "")
    .replace(COMPANY_NOISE, "")
    .replace(PUNCT, "")
    .replace(MULTI_SPACE, " ")
    .toLowerCase()
    .trim();
}

export function normalizeTitle(raw: string): string {
  return raw
    .replace(TITLE_SENIORITY, "")
    .replace(TITLE_LEVEL_SUFFIX, "")
    .replace(PUNCT, "")
    .replace(MULTI_SPACE, " ")
    .toLowerCase()
    .trim();
}

// ── External job ID extraction ────────────────────────────────────────────────

function extractExternalJobId(portal: string, url: string): string | undefined {
  try {
    const u = new URL(url);
    switch (portal) {
      case "linkedin": {
        // /jobs/view/4265909
        return u.pathname.match(/\/jobs\/view\/(\d+)/)?.[1];
      }
      case "greenhouse": {
        // /company/jobs/12345
        return u.pathname.match(/\/jobs\/(\d+)/)?.[1];
      }
      case "lever":
      case "ashby": {
        // /company/UUID  — second path segment is the job UUID
        return u.pathname.split("/").filter(Boolean)[1];
      }
      case "indeed": {
        return u.searchParams.get("jk") ?? u.searchParams.get("vjk") ?? undefined;
      }
      case "glassdoor": {
        return u.searchParams.get("jl") ?? u.searchParams.get("jobListingId") ?? undefined;
      }
      case "wellfound": {
        // /jobs/4265909-product-manager OR /company/slug/jobs/4265909-slug
        return u.pathname.match(/\/jobs\/(\d+)/)?.[1];
      }
      case "smartrecruiters": {
        // /CompanyName/ID  — second segment
        return u.pathname.split("/").filter(Boolean)[1];
      }
      case "workable": {
        // /company/j/SHORTCODE
        return u.pathname.split("/").filter(Boolean)[2];
      }
      case "bamboohr": {
        return u.pathname.match(/\/careers\/(\d+)/)?.[1]
          ?? u.searchParams.get("id")
          ?? undefined;
      }
      case "jobvite": {
        return u.pathname.match(/\/job\/([^/]+)/)?.[1];
      }
      case "icims": {
        return u.pathname.match(/\/jobs\/(\d+)\//)?.[1];
      }
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

// ── Canonical URL ─────────────────────────────────────────────────────────────

const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "ref", "refId", "trk", "trkInfo", "originalSubdomain",
];

function canonicalize(url: string): string {
  try {
    const u = new URL(url);
    TRACKING_PARAMS.forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return url;
  }
}

// ── SHA-256 via Web Crypto ────────────────────────────────────────────────────

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf  = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Builds a stable canonical fingerprint for a job posting.
 *
 * Hash priority (most → least stable):
 *   1. portal + externalJobId  (ATS-native ID — survives URL changes)
 *   2. portal + company + title + location  (survives reposts with different IDs)
 *   3. canonicalUrl  (last resort — still better than raw URL)
 */
export async function buildFingerprint(
  portal: string,
  jobData: LinkedInJobData,
): Promise<JobFingerprint> {
  const externalJobId    = extractExternalJobId(portal, jobData.url);
  const normalizedCompany = normalizeCompany(jobData.company);
  const normalizedTitle   = normalizeTitle(jobData.title);
  const normalizedLocation = jobData.location
    ? jobData.location.split(",").slice(0, 2).join(",").toLowerCase().trim()
    : undefined;
  const canonicalUrl = canonicalize(jobData.url);

  let hashInput: string;
  if (externalJobId) {
    hashInput = `${portal}:job:${externalJobId}`;
  } else if (normalizedCompany && normalizedTitle) {
    hashInput = `${portal}:${normalizedCompany}:${normalizedTitle}:${normalizedLocation ?? ""}`;
  } else {
    hashInput = canonicalUrl;
  }

  const hash = await sha256hex(hashInput);

  return {
    portal,
    canonicalUrl,
    externalJobId,
    normalizedCompany,
    normalizedTitle,
    normalizedLocation,
    hash,
  };
}
