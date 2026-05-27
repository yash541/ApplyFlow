import type { LinkedInJobData } from "@applyflow/shared";
import { type JobPortalAdapter } from "../shared/portal-runner";
import { extractJobFromJsonLd, slugToTitle } from "../shared/json-ld";

// jobs.smartrecruiters.com/COMPANY/NUMERIC_ID-title-slug

function parseUrl() {
  const parts = location.pathname.split("/").filter(Boolean);
  // parts[0] = company slug, parts[1] = "12345-title-slug"
  const company = parts[0] ?? "";
  const jobId = (parts[1] ?? "").split("-")[0] ?? "";
  return { company, jobId };
}

export const smartrecruitersAdapter: JobPortalAdapter = {
  portalName: "SmartRecruiters",

  isJobPage() {
    const parts = location.pathname.split("/").filter(Boolean);
    // Two path segments, second starts with a numeric job ID
    return parts.length === 2 && /^\d+/.test(parts[1] ?? "");
  },

  scrapeJobData(): LinkedInJobData | null {
    // 1. JSON-LD
    const ld = extractJobFromJsonLd();
    if (ld) return { ...ld, url: location.href };

    // 2. DOM — SmartRecruiters uses data-qa attributes
    const title =
      document.querySelector<HTMLElement>('[data-qa="job-header-title"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="jobHeaderTitle"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>("h1")?.textContent?.trim();

    const { company: companySlug } = parseUrl();
    const company =
      document.querySelector<HTMLElement>('[data-qa="job-header-company"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="companyName"]')?.textContent?.trim() ??
      (companySlug ? slugToTitle(companySlug) : undefined);

    if (!title || !company) return null;

    const description =
      document.querySelector<HTMLElement>('[class*="jobDescription"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[data-qa="job-description"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="job-description"]')?.textContent?.trim() ??
      "";

    const jobLocation =
      document.querySelector<HTMLElement>('[data-qa="job-header-location"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="location"]')?.textContent?.trim() ??
      "";

    return { title, company, description, location: jobLocation, url: location.href };
  },
};
