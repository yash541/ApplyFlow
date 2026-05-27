import { isExtensionValid } from "../shared/portal-runner";

/**
 * Declarative description of how a portal signals job navigation.
 *
 * url_params    — URL query params change (Indeed jk/vjk, Glassdoor jl)
 * dom_text      — an element's text changes without a URL update (Glassdoor India)
 * history_api   — pushState / replaceState / popstate (LinkedIn, Wellfound)
 * none          — full page reload on every job (Greenhouse, Lever, etc.)
 */
export type NavigationStrategy =
  | { type: "url_params"; keys: string[] }
  | { type: "dom_text"; selector: string }
  | { type: "history_api" }
  | { type: "none" };

/**
 * Set up navigation watching for a portal. Centralizes all MutationObserver /
 * history-API patching that was previously duplicated across every adapter's
 * watchNavigation() implementation.
 *
 * The returned cleanup function disconnects observers and restores history methods.
 */
export function watchNavigation(
  strategy: NavigationStrategy,
  onNavigate: () => void,
  valid: () => boolean = isExtensionValid,
): () => void {
  if (strategy.type === "none") return () => {};

  // ── URL params ─────────────────────────────────────────────────────────────
  if (strategy.type === "url_params") {
    const { keys } = strategy;

    const getSnapshot = () => {
      const p = new URLSearchParams(location.search);
      return keys.map((k) => p.get(k) ?? "").join("|");
    };

    let last = getSnapshot();

    const observer = new MutationObserver(() => {
      if (!valid()) return;
      const current = getSnapshot();
      // Only fire if at least one key now has a value AND the snapshot changed
      if (current !== last && keys.some((k) => new URLSearchParams(location.search).has(k))) {
        last = current;
        onNavigate();
      }
    });
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }

  // ── DOM text change ────────────────────────────────────────────────────────
  if (strategy.type === "dom_text") {
    const { selector } = strategy;
    let lastText = document.querySelector<HTMLElement>(selector)?.textContent?.trim() ?? "";

    const observer = new MutationObserver(() => {
      if (!valid()) return;
      const current = document.querySelector<HTMLElement>(selector)?.textContent?.trim() ?? "";
      if (current && current !== lastText) {
        lastText = current;
        onNavigate();
      }
    });
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }

  // ── History API ────────────────────────────────────────────────────────────
  if (strategy.type === "history_api") {
    let lastHref = location.href;

    const checkChange = () => {
      if (!valid()) return;
      if (location.href !== lastHref) {
        lastHref = location.href;
        onNavigate();
      }
    };

    // Patch pushState / replaceState so we hear programmatic navigations
    const origPush    = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    history.pushState    = (...args: Parameters<typeof history.pushState>) => {
      origPush(...args);
      checkChange();
    };
    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
      origReplace(...args);
      checkChange();
    };

    window.addEventListener("popstate", checkChange);

    return () => {
      history.pushState    = origPush;
      history.replaceState = origReplace;
      window.removeEventListener("popstate", checkChange);
    };
  }

  return () => {};
}
