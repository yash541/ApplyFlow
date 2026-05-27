import type { LinkedInJobData } from "@applyflow/shared";
import { type JobPortalAdapter } from "../shared/portal-runner";
import { extractJobFromJsonLd, slugToTitle } from "../shared/json-ld";

// jobs.jobvite.com/COMPANY/job/JOBID

function parseUrl() {
  // /company-slug/job/JOBID
  const parts = location.pathname.split("/").filter(Boolean);
  const jobIdx = parts.indexOf("job");
  return {
    company: parts[0] ?? "",
    jobId: jobIdx !== -1 ? (parts[jobIdx + 1] ?? "") : "",
  };
}

export const jobviteAdapter: JobPortalAdapter = {
  portalName: "Jobvite",

  isJobPage() {
    // Require /COMPANY/job/JOBID in path
    const parts = location.pathname.split("/").filter(Boolean);
    const jobIdx = parts.indexOf("job");
    return jobIdx !== -1 && !!parts[jobIdx + 1];
  },

  scrapeJobData(): LinkedInJobData | null {
    // 1. JSON-LD
    const ld = extractJobFromJsonLd();
    if (ld) return { ...ld, url: location.href };

    // 2. DOM — Jobvite uses fairly stable class structure
    const title =
      document.querySelector<HTMLElement>(".jv-header")?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="jv-job-detail-meta"] h2')?.textContent?.trim() ??
      document.querySelector<HTMLElement>("h1")?.textContent?.trim() ??
      document.querySelector<HTMLElement>("h2")?.textContent?.trim();

    const { company: companySlug } = parseUrl();
    const company =
      document.querySelector<HTMLElement>(".jv-company")?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="jv-company"]')?.textContent?.trim() ??
      (companySlug ? slugToTitle(companySlug) : undefined);

    if (!title || !company) return null;

    const description =
      document.querySelector<HTMLElement>(".jv-job-detail-description")?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="jv-job-detail"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="description"]')?.textContent?.trim() ??
      "";

    const jobLocation =
      document.querySelector<HTMLElement>(".jv-job-detail-meta-location")?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="location"]')?.textContent?.trim() ??
      "";

    return { title, company, description, location: jobLocation, url: location.href };
  },
};
