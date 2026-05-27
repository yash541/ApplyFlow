import type { LinkedInJobData } from "@applyflow/shared";
import { type JobPortalAdapter } from "../shared/portal-runner";
import { extractJobFromJsonLd, slugToTitle } from "../shared/json-ld";

// boards.greenhouse.io/COMPANY/jobs/ID
function parseUrl() {
  const parts = location.pathname.split("/").filter(Boolean);
  return { company: parts[0] ?? "", jobId: parts[2] ?? "" };
}

export const greenhouseAdapter: JobPortalAdapter = {
  portalName: "Greenhouse",

  isJobPage() {
    // Require exactly: /COMPANY/jobs/NUMERIC_ID
    const parts = location.pathname.split("/").filter(Boolean);
    return parts.length >= 3 && parts[1] === "jobs" && /^\d+$/.test(parts[2]);
  },

  async scrapeJobData(): Promise<LinkedInJobData | null> {
    // 1. JSON-LD (instant, no network)
    const ld = extractJobFromJsonLd();
    if (ld) return { ...ld, url: location.href };

    // 2. Greenhouse Boards API (public, no auth needed)
    const { company, jobId } = parseUrl();
    if (!company || !jobId) return null;

    try {
      const res = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${company}/jobs/${jobId}`,
      );
      if (!res.ok) return null;
      const data = await res.json() as {
        title?: string;
        content?: string;
        location?: { name?: string };
      };
      if (!data.title) return null;

      const tmp = document.createElement("div");
      tmp.innerHTML = data.content ?? "";
      const description = tmp.textContent?.trim() ?? "";

      return {
        title: data.title,
        company: slugToTitle(company),
        description,
        location: data.location?.name ?? "",
        url: location.href,
      };
    } catch { return null; }
  },
};
