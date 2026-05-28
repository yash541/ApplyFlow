/**
 * Fire-and-forget telemetry helper.
 *
 * Events are sent to the background service worker which batches them in
 * memory. The batch is ready to be flushed to a backend endpoint in a future
 * sprint. Critically: this function is designed so that ANY failure (extension
 * context invalidated, background crash, JSON error) is silently swallowed.
 * It must never block or throw in the calling code.
 */
export function track(event: string, props: Record<string, unknown> = {}): void {
  try {
    if (typeof chrome === "undefined" || !chrome?.runtime?.id) return;
    chrome.runtime.sendMessage({
      type: "TELEMETRY",
      payload: {
        event,
        timestamp: new Date().toISOString(),
        ...props,
      },
    });
  } catch {
    // Silently swallow — telemetry must never affect the main flow
  }
}
