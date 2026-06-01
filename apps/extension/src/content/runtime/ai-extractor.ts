import type { LinkedInJobData, ExtensionMessage } from "@applyflow/shared";

const MAX_TEXT_LENGTH = 8000; // characters sent to ApplyFlow AI — matches server-side cap

/**
 * Last-resort extraction using ApplyFlow AI when all DOM scrape attempts fail.
 *
 * Grabs the page's innerText (truncated), routes it through the background
 * service worker to POST /api/v1/ai/extract-job, and returns a LinkedInJobData
 * if ApplyFlow AI is confident enough (>= 0.5). Returns null on any failure.
 */
export async function aiExtractJobData(
  portal: string,
): Promise<LinkedInJobData | null> {
  const pageText = (document.body?.innerText ?? "").slice(0, MAX_TEXT_LENGTH);
  if (pageText.length < 100) return null; // page not loaded enough to be useful

  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        {
          type: "EXTRACT_JOB_AI",
          payload: { pageText, url: location.href, portal },
        } as ExtensionMessage,
        (result: {
          title?: string | null;
          company?: string | null;
          description?: string | null;
          location?: string | null;
          confidence?: number;
        } | null) => {
          if (chrome.runtime.lastError || !result) { resolve(null); return; }
          if (!result.title || !result.company) { resolve(null); return; }
          if ((result.confidence ?? 0) < 0.5) { resolve(null); return; }

          resolve({
            title: result.title,
            company: result.company,
            description: result.description ?? "",
            location: result.location ?? "",
            url: location.href,
          });
        },
      );
    } catch {
      resolve(null);
    }
  });
}
