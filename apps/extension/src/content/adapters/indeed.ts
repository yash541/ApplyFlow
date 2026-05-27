import type { LinkedInJobData } from "@applyflow/shared";
import { type JobPortalAdapter } from "../shared/portal-runner";
import { watchNavigation } from "../runtime/navigation-manager";

// indeed.com/viewjob?jk=JOBKEY  (full page)
// indeed.com/jobs?q=...&vjk=JOBKEY  (split-panel view — SPA, URL changes on job click)
// Covers all country subdomains: www, in, uk, ca, au, etc.
// No JSON-LD, no public API — read the already-rendered DOM.

function getJobKey(): string | null {
  const params = new URLSearchParams(location.search);
  return params.get("jk") ?? params.get("vjk") ?? null;
}

export const indeedAdapter: JobPortalAdapter = {
  portalName: "Indeed",
  scrapeUrlParam: "jk",

  isJobPage() {
    // Full viewjob page OR search-results split panel with a job selected
    return (
      location.pathname.endsWith("/viewjob") ||
      (location.pathname.endsWith("/jobs") && new URLSearchParams(location.search).has("vjk")) ||
      new URLSearchParams(location.search).has("jk")
    );
  },

  scrapeJobData(): LinkedInJobData | null {
    // Title — cover both /viewjob (h1) and split-panel (h2 with jobTitle class)
    const title =
      document.querySelector<HTMLElement>(
        '[data-testid="jobsearch-JobInfoHeader-title"] span[title]',
      )?.getAttribute("title")?.trim() ??
      document.querySelector<HTMLElement>(
        '[data-testid="jobsearch-JobInfoHeader-title"]',
      )?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[data-testid="simcenter-title"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>("h1")?.textContent?.trim() ??
      document.querySelector<HTMLElement>('h2[class*="jobTitle"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="jobTitle"]')?.textContent?.trim();

    // Company
    const company =
      document.querySelector<HTMLElement>(
        '[data-testid="inlineHeader-companyName"] a',
      )?.textContent?.trim() ??
      document.querySelector<HTMLElement>(
        '[data-testid="inlineHeader-companyName"]',
      )?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[data-testid="company-name"]')?.textContent?.trim();

    if (!title || !company) return null;

    // Description — #jobDescriptionText is stable across layouts
    const description =
      document.querySelector<HTMLElement>("#jobDescriptionText")?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[id*="jobDescription"]')?.textContent?.trim() ??
      "";

    // Location
    const jobLocation =
      document.querySelector<HTMLElement>('[data-testid="text-location"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[data-testid="job-location"]')?.textContent?.trim() ??
      "";

    // Build canonical URL — use jobKey so it's consistent across search panel and viewjob page
    const jk = getJobKey();
    const canonicalUrl = jk
      ? `https://${location.hostname}/viewjob?jk=${jk}`
      : location.href;

    return { title, company, description, location: jobLocation, url: canonicalUrl };
  },

  watchNavigation(onNavigate) {
    watchNavigation({ type: "url_params", keys: ["jk", "vjk"] }, onNavigate);
  },
};
