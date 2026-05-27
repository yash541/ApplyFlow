import type { LinkedInJobData } from "@applyflow/shared";
import { type JobPortalAdapter } from "../shared/portal-runner";
import { slugToTitle } from "../shared/json-ld";

// COMPANY.bamboohr.com/careers/ID  (or /jobs/view.php?id=ID)
// BambooHR does not include JSON-LD. It uses stable "BambooHR-ATS-" prefixed class names.

function companyFromHost(): string {
  // e.g. "acme.bamboohr.com" → "Acme"
  const sub = location.hostname.split(".")[0] ?? "";
  return slugToTitle(sub);
}

export const bamboohrAdapter: JobPortalAdapter = {
  portalName: "BambooHR",

  isJobPage() {
    const { pathname, search } = location;
    // /careers/ID  or  /jobs/view.php?id=ID
    return (
      /^\/careers\/\d+/.test(pathname) ||
      (pathname.includes("/jobs/view.php") && new URLSearchParams(search).has("id"))
    );
  },

  scrapeJobData(): LinkedInJobData | null {
    const company = companyFromHost();

    // BambooHR uses stable "BambooHR-ATS-" prefixed identifiers
    const title =
      document.querySelector<HTMLElement>(
        ".BambooHR-ATS-Jobs-Details--title",
      )?.textContent?.trim() ??
      document.querySelector<HTMLElement>(
        "[class*='BambooHR-ATS-Jobs-Details--title']",
      )?.textContent?.trim() ??
      document.querySelector<HTMLElement>("h2")?.textContent?.trim() ??
      document.querySelector<HTMLElement>("h1")?.textContent?.trim();

    if (!title) return null;

    const description =
      document.querySelector<HTMLElement>(
        "#BambooHR-ATS-Jobs-Details--description",
      )?.textContent?.trim() ??
      document.querySelector<HTMLElement>(
        "[id*='BambooHR-ATS'][id*='description']",
      )?.textContent?.trim() ??
      document.querySelector<HTMLElement>("[class*='description']")?.textContent?.trim() ??
      "";

    const jobLocation =
      document.querySelector<HTMLElement>(
        "[class*='BambooHR-ATS-Jobs-Details--location']",
      )?.textContent?.trim() ??
      document.querySelector<HTMLElement>("[class*='location']")?.textContent?.trim() ??
      "";

    return { title, company, description, location: jobLocation, url: location.href };
  },
};
