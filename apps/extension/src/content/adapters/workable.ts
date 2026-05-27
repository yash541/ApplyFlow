import type { LinkedInJobData } from "@applyflow/shared";
import { type JobPortalAdapter } from "../shared/portal-runner";
import { extractJobFromJsonLd, slugToTitle } from "../shared/json-ld";

// apply.workable.com/COMPANY/j/SHORTCODE/

function parseUrl() {
  // /company-slug/j/ABC123/
  const parts = location.pathname.split("/").filter(Boolean);
  return { company: parts[0] ?? "", shortcode: parts[2] ?? "" };
}

export const workableAdapter: JobPortalAdapter = {
  portalName: "Workable",

  isJobPage() {
    // /COMPANY/j/SHORTCODE  — three segments, middle must be "j"
    const parts = location.pathname.split("/").filter(Boolean);
    return parts.length >= 3 && parts[1] === "j" && !!parts[2];
  },

  scrapeJobData(): LinkedInJobData | null {
    // 1. JSON-LD
    const ld = extractJobFromJsonLd();
    if (ld) return { ...ld, url: location.href };

    // 2. DOM
    const title =
      document.querySelector<HTMLElement>('[data-ui="job-title"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>("h1")?.textContent?.trim();

    const { company: companySlug } = parseUrl();
    const company =
      document.querySelector<HTMLElement>('[data-ui="company-name"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="companyName"]')?.textContent?.trim() ??
      (companySlug ? slugToTitle(companySlug) : undefined);

    if (!title || !company) return null;

    const description =
      document.querySelector<HTMLElement>('[data-ui="job-description"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="job-description"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>("article")?.textContent?.trim() ??
      "";

    const jobLocation =
      document.querySelector<HTMLElement>('[data-ui="job-location"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="location"]')?.textContent?.trim() ??
      "";

    return { title, company, description, location: jobLocation, url: location.href };
  },
};
