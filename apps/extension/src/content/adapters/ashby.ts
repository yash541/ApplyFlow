import type { LinkedInJobData } from "@applyflow/shared";
import { type JobPortalAdapter } from "../shared/portal-runner";
import { extractJobFromJsonLd, slugToTitle } from "../shared/json-ld";

// jobs.ashbyhq.com/COMPANY/UUID
function parseUrl() {
  const parts = location.pathname.split("/").filter(Boolean);
  return { company: parts[0] ?? "", uuid: parts[1] ?? "" };
}

export const ashbyAdapter: JobPortalAdapter = {
  portalName: "Ashby",

  isJobPage() {
    // Require: /COMPANY/UUID — two path segments, second is UUID-like
    const parts = location.pathname.split("/").filter(Boolean);
    return parts.length === 2 && parts[1].length > 20 && parts[1].includes("-");
  },

  async scrapeJobData(): Promise<LinkedInJobData | null> {
    // 1. JSON-LD (instant, no network)
    const ld = extractJobFromJsonLd();
    if (ld) return { ...ld, url: location.href };

    // 2. Ashby job board API — fetch all postings for the company, find by UUID
    const { company, uuid } = parseUrl();
    if (!company || !uuid) return null;

    try {
      const res = await fetch(
        `https://api.ashbyhq.com/posting-api/job-board/${company}`,
      );
      if (!res.ok) return null;
      const data = await res.json() as {
        results?: Array<{
          id?: string;
          title?: string;
          descriptionHtml?: string;
          descriptionPlain?: string;
          location?: { name?: string };
        }>;
      };

      const job = data.results?.find((j) => j.id === uuid);
      if (!job?.title) return null;

      const tmp = document.createElement("div");
      tmp.innerHTML = job.descriptionHtml ?? job.descriptionPlain ?? "";
      const description = tmp.textContent?.trim() ?? "";

      return {
        title: job.title,
        company: slugToTitle(company),
        description,
        location: job.location?.name ?? "",
        url: location.href,
      };
    } catch { return null; }
  },
};
