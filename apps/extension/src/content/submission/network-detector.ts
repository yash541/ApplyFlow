/**
 * Intercepts the page's fetch + XMLHttpRequest to detect POSTs to job-apply endpoints.
 *
 * Content scripts run in an isolated world, so we inject a tiny <script> tag into
 * the page's main world that patches fetch/XHR, then posts a message back via
 * window.postMessage. The content script listens for that message.
 */

export type NetworkSignal = {
  method: string;
  url: string;
  confidence: number;
};

// Patterns that match actual application-submit endpoints across major portals
const APPLY_PATTERNS_SRC = [
  "\\/applyJobPosting",         // LinkedIn
  "\\/jobs\\/applystart",       // Indeed
  "desktopapply\\/submit",      // Indeed legacy
  "\\/apply\\b",                // Greenhouse, Lever, Ashby
  "\\/submit[-_]?application",  // generic ATS
  "\\/job[-_]?application",     // generic ATS
  "\\/careers\\/apply",         // generic
  "\\/application\\/submit",    // SmartRecruiters
  "\\/applications$",           // Wellfound, Workable (POST to collection)
  "\\/resumes\\/apply",         // Bamboohr
].join("|");

// ── Page-world injected script ────────────────────────────────────────────────
// Runs inside the page (not the isolated content-script world) so it can
// actually see and patch window.fetch / XMLHttpRequest.

function buildInjectScript(patterns: string): string {
  return `(function() {
    if (window.__af_net_patched) return;
    window.__af_net_patched = true;

    var RE = new RegExp(${JSON.stringify(patterns)}, "i");
    function isApply(url, method) {
      return method && method.toUpperCase() === "POST" && RE.test(url);
    }
    function signal(url, method) {
      window.postMessage({ type: "__AF_NETWORK_SIGNAL__", url: url, method: method }, "*");
    }

    // Patch fetch
    var _fetch = window.fetch;
    window.fetch = function(input, init) {
      try {
        var url = typeof input === "string" ? input
                : input instanceof URL ? input.toString()
                : input.url;
        var method = (init && init.method) || "GET";
        if (isApply(url, method)) signal(url, method);
      } catch(e) {}
      return _fetch.apply(this, arguments);
    };

    // Patch XHR
    var _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      this.__af_method = method;
      this.__af_url = typeof url === "string" ? url : String(url);
      return _open.apply(this, arguments);
    };
    var _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function() {
      try {
        if (isApply(this.__af_url || "", this.__af_method || "")) {
          signal(this.__af_url, this.__af_method);
        }
      } catch(e) {}
      return _send.apply(this, arguments);
    };
  })();`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startNetworkDetector(
  onSignal: (signal: NetworkSignal) => void,
): () => void {
  // Inject the page-world script
  const script = document.createElement("script");
  script.textContent = buildInjectScript(APPLY_PATTERNS_SRC);
  (document.head ?? document.documentElement).appendChild(script);
  script.remove(); // cleanup the DOM element; the patching already ran

  function handleMessage(event: MessageEvent) {
    if (event.source !== window) return;
    const data = event.data as { type?: string; url?: string; method?: string } | null;
    if (data?.type !== "__AF_NETWORK_SIGNAL__" || !data.url || !data.method) return;
    onSignal({ url: data.url, method: data.method, confidence: 0.6 });
  }

  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}
