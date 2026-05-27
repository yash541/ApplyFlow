import type { LinkedInJobData } from "@applyflow/shared";
import { type JobPortalAdapter } from "../shared/portal-runner";
import { extractJobFromJsonLd } from "../shared/json-ld";
import { watchNavigation } from "../runtime/navigation-manager";

// Covers all Glassdoor country domains:
//   www.glassdoor.com, glassdoor.co.in, glassdoor.co.uk, glassdoor.com.au, glassdoor.de, etc.
//
// Three page types:
//   1. Direct job listing:   /job-listing/TITLE-COMPANY-...?jl=ID
//   2. Search split-panel:   /Job/index.htm?jl=ID  (URL updated on job click)
//   3. Search split-panel:   /Job/index.htm  (no URL param — job shown via SPA state only)

function getJobListingId(): string | null {
  const params = new URLSearchParams(location.search);
  return params.get("jl") ?? params.get("jobListingId") ?? null;
}

function isJobDetailVisible(): boolean {
  // data-test="job-title" appears in the right-panel detail view, not in list cards
  return !!(
    document.querySelector('[data-test="job-title"]') ??
    document.querySelector('[class*="JobCard_sideHover"]')
  );
}

export const glassdoorAdapter: JobPortalAdapter = {
  portalName: "Glassdoor",

  isJobPage() {
    return (
      location.pathname.includes("/job-listing/") ||
      !!getJobListingId() ||
      // Split-panel with no URL param (SPA state only — e.g. glassdoor.co.in/Job/index.htm)
      (location.pathname.toLowerCase().includes("/job/") && isJobDetailVisible())
    );
  },

  scrapeJobData(): LinkedInJobData | null {
    // 1. JSON-LD (present on full job listing pages for SEO)
    const ld = extractJobFromJsonLd();
    if (ld) return { ...ld, url: location.href };

    // 2. DOM — data-test attributes are stable across React rebuilds.
    //    In the split-panel the same attributes appear inside the detail pane.
    const title =
      document.querySelector<HTMLElement>('[data-test="job-title"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="JobCard_sideHover"] h1')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="jobTitle"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>("h1")?.textContent?.trim();

    const company =
      document.querySelector<HTMLElement>('[data-test="employer-name"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="EmployerProfile"] [class*="name"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="employerName"]')?.textContent?.trim();

    if (!title || !company) return null;

    const description =
      document.querySelector<HTMLElement>('[data-test="jobDescriptionContent"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="JobDescription_jobDescription"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="desc_"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="description"]')?.textContent?.trim() ??
      "";

    const jobLocation =
      document.querySelector<HTMLElement>('[data-test="emp-location"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="location"]')?.textContent?.trim() ??
      "";

    return { title, company, description, location: jobLocation, url: location.href };
  },

  watchNavigation(onNavigate) {
    // Portals that update the URL (www.glassdoor.com) use jl= param.
    // Portals that don't update the URL (glassdoor.co.in) are detected via
    // the job-title element changing in the right panel.
    watchNavigation({ type: "url_params", keys: ["jl", "jobListingId"] }, onNavigate);
    watchNavigation({ type: "dom_text", selector: '[data-test="job-title"]' }, onNavigate);
  },
};
