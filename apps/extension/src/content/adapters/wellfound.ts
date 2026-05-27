import type { LinkedInJobData } from "@applyflow/shared";
import { type JobPortalAdapter } from "../shared/portal-runner";
import { extractJobFromJsonLd, slugToTitle } from "../shared/json-ld";

// Two URL formats:
//   wellfound.com/company/{slug}/jobs/{id}-{title-slug}  (legacy deep link)
//   wellfound.com/jobs/{id}-{title-slug}                 (current canonical URL)
// Next.js app — parse __NEXT_DATA__ script tag first, then JSON-LD, then DOM.

function extractFromNextData(): Omit<LinkedInJobData, "url"> | null {
  try {
    const el = document.getElementById("__NEXT_DATA__");
    if (!el) return null;

    const root = JSON.parse(el.textContent ?? "") as Record<string, unknown>;

    // Walk the Apollo/Next.js state looking for a job posting object.
    // Wellfound embeds data at props.pageProps or in an Apollo flat cache.
    const pageProps = (root as { props?: { pageProps?: unknown } }).props?.pageProps;

    // Try direct pageProps fields (some Wellfound page variants)
    const direct = pageProps as Record<string, unknown> | undefined;
    if (direct) {
      const title =
        (direct["jobTitle"] as string | undefined)?.trim() ??
        ((direct["role"] as Record<string, unknown> | undefined)?.["title"] as string | undefined)?.trim();
      const company =
        (direct["companyName"] as string | undefined)?.trim() ??
        ((direct["startup"] as Record<string, unknown> | undefined)?.["name"] as string | undefined)?.trim();

      if (title && company) {
        const rawDesc =
          (direct["jobDescription"] as string | undefined) ??
          ((direct["role"] as Record<string, unknown> | undefined)?.["description"] as string | undefined) ??
          "";
        const tmp = document.createElement("div");
        tmp.innerHTML = rawDesc;
        const description = tmp.textContent?.trim() ?? rawDesc;

        const locArr = direct["jobLocationNames"] as string[] | undefined;
        const jobLocation = Array.isArray(locArr) ? locArr.join(", ") : "";

        return { title, company, description, location: jobLocation };
      }
    }

    // Try Apollo flat cache — looks like: { "JobListing:12345": { title, ... }, ... }
    const apolloState =
      (direct?.["apolloState"] as Record<string, unknown> | undefined) ??
      (direct?.["__APOLLO_STATE__"] as Record<string, unknown> | undefined);

    if (apolloState) {
      const jobEntry = Object.values(apolloState).find(
        (v) =>
          typeof v === "object" &&
          v !== null &&
          typeof (v as Record<string, unknown>)["title"] === "string" &&
          (typeof (v as Record<string, unknown>)["description"] === "string" ||
            typeof (v as Record<string, unknown>)["descriptionHtml"] === "string"),
      ) as Record<string, unknown> | undefined;

      if (jobEntry) {
        const title = (jobEntry["title"] as string).trim();
        const rawDesc =
          (jobEntry["descriptionHtml"] as string | undefined) ??
          (jobEntry["description"] as string | undefined) ??
          "";
        const tmp = document.createElement("div");
        tmp.innerHTML = rawDesc;
        const description = tmp.textContent?.trim() ?? rawDesc;

        // Company may be a ref or direct name
        const companyName =
          (jobEntry["companyName"] as string | undefined)?.trim() ??
          ((jobEntry["company"] as Record<string, unknown> | undefined)?.["name"] as string | undefined)?.trim();

        if (title && companyName) {
          const locArr = jobEntry["locationNames"] as string[] | undefined;
          const jobLocation = Array.isArray(locArr) ? locArr.join(", ") : "";
          return { title, company: companyName, description, location: jobLocation };
        }
      }
    }
  } catch { /* malformed JSON or unexpected shape */ }
  return null;
}

// Extract company slug from URL for fallback naming
function parseUrl() {
  const parts = location.pathname.split("/").filter(Boolean);
  // /company/{slug}/jobs/{id}-{title-slug}
  if (parts[0] === "company") {
    return { companySlug: parts[1] ?? "" };
  }
  // /jobs/{id}-{title-slug} — no company in URL
  return { companySlug: "" };
}

export const wellfoundAdapter: JobPortalAdapter = {
  portalName: "Wellfound",

  isJobPage() {
    const parts = location.pathname.split("/").filter(Boolean);
    // /jobs/{id}-{slug}  (current canonical)
    if (parts[0] === "jobs" && /^\d/.test(parts[1] ?? "")) return true;
    // /company/{slug}/jobs/{id}-{slug}  (legacy deep link)
    if (parts[0] === "company" && parts[2] === "jobs" && /^\d/.test(parts[3] ?? "")) return true;
    return false;
  },

  scrapeJobData(): LinkedInJobData | null {
    // 1. __NEXT_DATA__ (most reliable for Next.js/Apollo apps)
    const fromNext = extractFromNextData();
    if (fromNext) return { ...fromNext, url: location.href };

    // 2. JSON-LD (may be present for SEO)
    const ld = extractJobFromJsonLd();
    if (ld) return { ...ld, url: location.href };

    // 3. DOM fallback
    const { companySlug } = parseUrl();

    const title =
      document.querySelector<HTMLElement>('[data-test="job-title"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>("h1")?.textContent?.trim();

    const company =
      document.querySelector<HTMLElement>('[data-test="company-name"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="company"] h2')?.textContent?.trim() ??
      (companySlug ? slugToTitle(companySlug) : undefined);

    if (!title || !company) return null;

    const description =
      document.querySelector<HTMLElement>('[class*="job-description"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="description"]')?.textContent?.trim() ??
      "";

    const jobLocation =
      document.querySelector<HTMLElement>('[class*="location"]')?.textContent?.trim() ?? "";

    return { title, company, description, location: jobLocation, url: location.href };
  },
};
