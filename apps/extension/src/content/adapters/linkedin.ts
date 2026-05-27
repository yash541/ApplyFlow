import type { LinkedInJobData } from "@applyflow/shared";
import { type JobPortalAdapter } from "../shared/portal-runner";
import { watchNavigation } from "../runtime/navigation-manager";

export const linkedInAdapter: JobPortalAdapter = {
  portalName: "LinkedIn",
  scrapeUrlParam: "currentJobId",

  isJobPage() {
    const url = location.href;
    return (
      url.includes("/jobs/view/") ||
      url.includes("/jobs/search/") ||
      url.includes("/jobs/collections/") ||
      new URLSearchParams(location.search).has("currentJobId")
    );
  },

  scrapeJobData(): LinkedInJobData | null {
    const title =
      document.querySelector(".job-details-jobs-unified-top-card__job-title")?.textContent?.trim() ??
      document.querySelector("h1.top-card-layout__title")?.textContent?.trim();

    const company =
      document.querySelector(".job-details-jobs-unified-top-card__company-name")?.textContent?.trim() ??
      document.querySelector(".topcard__org-name-link")?.textContent?.trim();

    const description =
      document.querySelector(".jobs-description__content")?.textContent?.trim() ??
      document.querySelector(".show-more-less-html__markup")?.textContent?.trim();

    const location =
      document.querySelector(".job-details-jobs-unified-top-card__bullet")?.textContent?.trim() ?? "";

    if (!title || !company) return null;
    return { title, company, location, description: description ?? "", url: window.location.href };
  },

  watchNavigation(onNavigate) {
    // Watch currentJobId param — fires during DOM updates (after React starts
    // re-rendering), not at pushState time (before DOM changes). This ensures
    // waitForStableDOM always starts with the new content already loading.
    watchNavigation(
      { type: "url_params", keys: ["currentJobId"] },
      onNavigate,
    );
  },
};
