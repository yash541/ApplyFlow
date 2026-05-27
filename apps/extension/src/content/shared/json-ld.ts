import type { LinkedInJobData } from "@applyflow/shared";

interface JobPostingJsonLd {
  "@type"?: string;
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string };
  jobLocation?:
    | { address?: { addressLocality?: string; addressRegion?: string } }
    | Array<{ address?: { addressLocality?: string; addressRegion?: string } }>;
}

function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent?.trim() ?? "";
}

/** Attempt to extract job data from schema.org/JobPosting JSON-LD blocks. */
export function extractJobFromJsonLd(): Omit<LinkedInJobData, "url"> | null {
  const scripts = document.querySelectorAll<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  );

  for (const script of scripts) {
    try {
      const raw = JSON.parse(script.textContent ?? "");
      const candidates: unknown[] = Array.isArray(raw) ? raw : [raw];

      for (const item of candidates) {
        const posting = item as JobPostingJsonLd;
        if (posting["@type"] !== "JobPosting") continue;

        const title = posting.title?.trim();
        const company = posting.hiringOrganization?.name?.trim();
        if (!title || !company) continue;

        const description = stripHtml(posting.description ?? "");

        const locRaw = posting.jobLocation;
        let location = "";
        const addr = Array.isArray(locRaw)
          ? locRaw[0]?.address
          : locRaw?.address;
        if (addr) {
          location = [addr.addressLocality, addr.addressRegion]
            .filter(Boolean)
            .join(", ");
        }

        return { title, company, description, location };
      }
    } catch { /* malformed JSON — skip */ }
  }
  return null;
}

/** Capitalise a URL slug: "two-sigma" → "Two Sigma" */
export function slugToTitle(slug: string): string {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
