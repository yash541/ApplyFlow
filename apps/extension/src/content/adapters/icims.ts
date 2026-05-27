import type { LinkedInJobData } from "@applyflow/shared";
import { type JobPortalAdapter } from "../shared/portal-runner";
import { extractJobFromJsonLd, slugToTitle } from "../shared/json-ld";

// COMPANY.icims.com/jobs/JOBID/job
// Job content is iframe-embedded. We fetch the iframe src with ?in_iframe=1 to get
// clean HTML in the same origin, avoiding cross-origin restrictions.

function companyFromHost(): string {
  // "acme.icims.com" → "Acme"
  const sub = location.hostname.split(".")[0] ?? "";
  return slugToTitle(sub);
}

async function fetchIframeContent(): Promise<{ title?: string; description?: string } | null> {
  try {
    // iCIMS loads the job detail inside an iframe.
    // ?in_iframe=1 strips the outer shell and returns just the job HTML.
    const iframeSrc =
      document.querySelector<HTMLIFrameElement>("iframe#icims_content_iframe")?.src ??
      document.querySelector<HTMLIFrameElement>("iframe[src*='icims.com']")?.src;

    const targetUrl = iframeSrc
      ? iframeSrc.replace(/[?&]in_iframe=\d/, "") + (iframeSrc.includes("?") ? "&" : "?") + "in_iframe=1"
      : location.href.replace(/[?&]in_iframe=\d/, "") + (location.search ? "&" : "?") + "in_iframe=1";

    const res = await fetch(targetUrl, { credentials: "include" });
    if (!res.ok) return null;

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const title =
      doc.querySelector<HTMLElement>('[class*="iCIMS_Header"] h1')?.textContent?.trim() ??
      doc.querySelector<HTMLElement>('[class*="iCIMS_JobTitle"]')?.textContent?.trim() ??
      doc.querySelector<HTMLElement>("h1")?.textContent?.trim();

    const description =
      doc.querySelector<HTMLElement>('[class*="iCIMS_JobContent"]')?.textContent?.trim() ??
      doc.querySelector<HTMLElement>('[id*="jobContent"]')?.textContent?.trim() ??
      doc.querySelector<HTMLElement>("article")?.textContent?.trim() ??
      "";

    return title ? { title, description } : null;
  } catch { return null; }
}

export const icimsAdapter: JobPortalAdapter = {
  portalName: "iCIMS",

  isJobPage() {
    // /jobs/NUMERIC_ID/job
    return /^\/jobs\/\d+\/job\b/.test(location.pathname);
  },

  async scrapeJobData(): Promise<LinkedInJobData | null> {
    const company = companyFromHost();

    // 1. JSON-LD — some iCIMS deployments include it
    const ld = extractJobFromJsonLd();
    if (ld) return { ...ld, url: location.href };

    // 2. Main document DOM (iCIMS may pre-render for SEO)
    const domTitle =
      document.querySelector<HTMLElement>('[class*="iCIMS_JobTitle"]')?.textContent?.trim() ??
      document.querySelector<HTMLElement>('[class*="iCIMS_Header"] h1')?.textContent?.trim();

    if (domTitle) {
      const description =
        document.querySelector<HTMLElement>('[class*="iCIMS_JobContent"]')?.textContent?.trim() ?? "";
      const jobLocation =
        document.querySelector<HTMLElement>('[class*="iCIMS_JobHeaderField"]')?.textContent?.trim() ?? "";
      return { title: domTitle, company, description, location: jobLocation, url: location.href };
    }

    // 3. Fetch iframe content with ?in_iframe=1 for clean HTML
    const iframe = await fetchIframeContent();
    if (iframe?.title) {
      return {
        title: iframe.title,
        company,
        description: iframe.description ?? "",
        location: "",
        url: location.href,
      };
    }

    // 4. Last resort — parse <title> tag: "Job Title | Company | iCIMS"
    const pageTitle = document.title.split(/[|\-–]/)[0]?.trim();
    if (pageTitle && pageTitle.length > 2) {
      return { title: pageTitle, company, description: "", location: "", url: location.href };
    }

    return null;
  },
};
