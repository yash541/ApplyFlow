import type { LinkedInJobData } from "@applyflow/shared";
import { type JobPortalAdapter } from "../shared/portal-runner";
import { extractJobFromJsonLd, slugToTitle } from "../shared/json-ld";

// jobs.lever.co/COMPANY/UUID
function parseUrl() {
  const parts = location.pathname.split("/").filter(Boolean);
  return { company: parts[0] ?? "", uuid: parts[1] ?? "" };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const leverAdapter: JobPortalAdapter = {
  portalName: "Lever",

  isJobPage() {
    // Require: /COMPANY/UUID — two path segments, second looks like a UUID
    const parts = location.pathname.split("/").filter(Boolean);
    return parts.length === 2 && UUID_RE.test(parts[1]);
  },

  async scrapeJobData(): Promise<LinkedInJobData | null> {
    // 1. JSON-LD (instant, no network)
    const ld = extractJobFromJsonLd();
    if (ld) return { ...ld, url: location.href };

    // 2. Lever public postings API (no auth needed)
    const { company, uuid } = parseUrl();
    if (!company || !uuid) return null;

    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${company}/${uuid}`);
      if (!res.ok) return null;
      const data = await res.json() as {
        text?: string;
        description?: string;
        descriptionPlain?: string;
        categories?: { location?: string };
      };
      if (!data.text) return null;

      const tmp = document.createElement("div");
      tmp.innerHTML = data.description ?? data.descriptionPlain ?? "";
      const description = tmp.textContent?.trim() ?? "";

      return {
        title: data.text,
        company: slugToTitle(company),
        description,
        location: data.categories?.location ?? "",
        url: location.href,
      };
    } catch { return null; }
  },
};
