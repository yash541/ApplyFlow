import type { LinkedInJobData } from "@applyflow/shared";

export interface ScrapeResult {
  jobData: LinkedInJobData;
  /** 1-based attempt number that succeeded (useful for telemetry). */
  attempts: number;
}

interface RetryOptions {
  /** Maximum scrape attempts before giving up. Default 3. */
  maxAttempts?: number;
  /** Base backoff in ms between attempts (multiplied by attempt number). Default 1000. */
  backoffMs?: number;
  /**
   * URL param key whose value must appear in the scraped job URL to confirm
   * we got fresh content (not stale DOM from the previous job).
   * On SPA portals the URL updates before the DOM does, so we can use the
   * current URL's job-ID param to validate the scrape result.
   */
  expectedUrlParam?: string;
}

/**
 * Wraps an adapter's scrapeJobData() with automatic retries and exponential backoff.
 *
 * A scrape is considered a failure if:
 *   - it throws,
 *   - it returns null, or
 *   - the result is missing title or company (partial data).
 *
 * Returns null after all attempts are exhausted.
 */
export async function scrapeWithRetries(
  scrape: () => LinkedInJobData | null | Promise<LinkedInJobData | null>,
  { maxAttempts = 3, backoffMs = 1000, expectedUrlParam }: RetryOptions = {},
): Promise<ScrapeResult | null> {
  // If the caller wants URL-param validation, capture the expected value NOW
  // (before any async waits) while location.search is already up-to-date.
  const expectedParamValue = expectedUrlParam
    ? new URLSearchParams(location.search).get(expectedUrlParam) ?? ""
    : null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const jobData = await Promise.resolve(scrape());

      if (jobData?.title && jobData?.company) {
        // If the caller gave us a URL param to validate, confirm that the
        // scraped job URL actually contains the expected value — otherwise the
        // DOM still shows the previous job and we need to retry.
        if (expectedParamValue !== null) {
          try {
            const scraped = new URL(jobData.url);
            const current = new URL(location.href);
            const scraped_val = scraped.searchParams.get(expectedUrlParam!) ?? scraped.pathname;
            const current_val = current.searchParams.get(expectedUrlParam!) ?? current.pathname;
            if (scraped_val !== current_val) throw new Error("stale");
          } catch (e) {
            if ((e as Error).message === "stale") {
              if (attempt < maxAttempts) {
                await new Promise<void>((r) => setTimeout(r, backoffMs * attempt));
              }
              continue;
            }
          }
        }
        return { jobData, attempts: attempt };
      }
    } catch {
      // Extraction threw — treated as a miss, will retry
    }

    if (attempt < maxAttempts) {
      await new Promise<void>((r) => setTimeout(r, backoffMs * attempt));
    }
  }

  return null;
}
