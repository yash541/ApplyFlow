interface StabilityOptions {
  /** Milliseconds of zero DOM mutations before the page is considered stable. Default 600. */
  stableWindow?: number;
  /** Hard timeout — resolve regardless after this many ms. Default 5000. */
  timeout?: number;
  /** Optional: also wait until document.body.innerText is at least this long. */
  minDescriptionLength?: number;
}

/**
 * Replaces the old `await new Promise(r => setTimeout(r, 1500))` pattern.
 * Resolves as soon as the DOM has been mutation-free for `stableWindow` ms
 * (or `timeout` ms elapses, whichever comes first).
 *
 * This prevents both under-waiting (fast connections) and over-waiting (slow
 * corporate SSO flows) that the fixed 1500ms caused.
 */
export function waitForStableDOM({
  stableWindow = 600,
  timeout = 5000,
  minDescriptionLength,
}: StabilityOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;

    function done() {
      if (resolved) return;
      resolved = true;
      observer.disconnect();
      if (settleTimer) clearTimeout(settleTimer);
      resolve();
    }

    function scheduleSettle() {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        // If a minimum description length is required, check it
        if (minDescriptionLength) {
          const len = document.body?.innerText?.length ?? 0;
          if (len < minDescriptionLength) {
            // Content not ready yet — wait one more window
            scheduleSettle();
            return;
          }
        }
        done();
      }, stableWindow);
    }

    const observer = new MutationObserver(scheduleSettle);
    observer.observe(document.body, { subtree: true, childList: true });

    // Kick off the initial settle timer (handles pages that are already stable)
    scheduleSettle();

    // Hard fallback — always resolve eventually
    setTimeout(done, timeout);
  });
}
