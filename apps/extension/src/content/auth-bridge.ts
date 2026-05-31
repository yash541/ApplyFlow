/**
 * Bidirectional auth sync — runs on every localhost:3000/* page.
 *
 * Direction 1 — Extension → Web App:
 *   On page load: if the extension is logged in but the web app isn't,
 *   write the session to localStorage so the web app auto-logs in.
 *
 * Direction 2 — Web App → Extension:
 *   Listen for localStorage changes: when the user logs in or out on the
 *   web app, sync the session to chrome.storage.local so the extension
 *   sees it immediately without the user needing to log in separately.
 *
 * Result: logging in on either side propagates to the other automatically.
 */

const SESSION_KEY = "af_session";

type SyncSession = {
  token: string;
  user: { id: string; name: string; email: string; plan: string; createdAt: string };
  expiresAt: string;
};

function isExpired(session: SyncSession): boolean {
  return Date.now() > new Date(session.expiresAt).getTime();
}

// ── Direction 0: Web App → Extension on page load ────────────────────────────
// Handles the "already logged in when extension loaded/reloaded" case.
// The af_login event only fires during the login action itself — if the user
// was already logged in, we need to proactively sync on each page load.

const _existingWebSession = localStorage.getItem(SESSION_KEY);
if (_existingWebSession) {
  try {
    const _ws = JSON.parse(_existingWebSession) as SyncSession;
    if (_ws.token && !isExpired(_ws)) {
      chrome.storage.local.get("session", (r) => {
        const extS = r["session"] as SyncSession | undefined;
        if (!extS?.token || isExpired(extS)) {
          // Extension has no valid session but web app does — sync it now
          chrome.storage.local.set({ session: _ws });
        }
      });
    }
  } catch { /* ignore malformed */ }
}

// ── Direction 1: Extension → Web App ─────────────────────────────────────────

chrome.storage.local.get("session", (result) => {
  const extSession = result["session"] as SyncSession | undefined;
  if (!extSession?.token || isExpired(extSession)) return;

  // Only sync if web app doesn't already have a valid session
  const webRaw = localStorage.getItem(SESSION_KEY);
  if (webRaw) {
    try {
      const webSession = JSON.parse(webRaw) as SyncSession;
      if (!isExpired(webSession)) return; // web app already has valid session
    } catch { /* fall through to sync */ }
  }

  // Write extension session into localStorage
  localStorage.setItem(SESSION_KEY, JSON.stringify(extSession));
  localStorage.setItem("af_token", extSession.token);

  // Dispatch event so the web app's Zustand store picks it up immediately
  // (no page reload needed)
  window.dispatchEvent(new CustomEvent("af_auth_sync", { detail: extSession }));
});

// ── Direction 2: Web App → Extension ─────────────────────────────────────────

// Case A: Same-tab login — storage event doesn't fire in the same tab,
// so setAuth dispatches af_login with the full session detail.
window.addEventListener("af_login", (e) => {
  try {
    const session = (e as CustomEvent<SyncSession>).detail;
    if (session?.token && !isExpired(session)) {
      chrome.storage.local.set({ session });
    }
  } catch { /* ignore */ }
});

// Case A2: Same-tab logout
window.addEventListener("af_logout", () => {
  chrome.storage.local.remove("session");
});

// Case B: Cross-tab login/logout — fires when another tab modifies localStorage.
window.addEventListener("storage", (e) => {
  if (e.key !== SESSION_KEY) return;

  if (e.newValue) {
    try {
      const session = JSON.parse(e.newValue) as SyncSession;
      if (!isExpired(session)) {
        chrome.storage.local.set({ session });
      }
    } catch { /* ignore malformed */ }
  } else {
    chrome.storage.local.remove("session");
  }
});

// Case C: Page loaded — sync extension session with web app state.
// Handles: user closed tab without logging out, navigation race on logout, etc.
const currentSession = localStorage.getItem(SESSION_KEY);
const logoutAt       = localStorage.getItem("af_logout_at");

if (!currentSession || logoutAt) {
  // Web app is logged out (or logout was requested) — ensure extension matches
  chrome.storage.local.get("session", (r) => {
    if (r["session"]) chrome.storage.local.remove("session");
  });
  // Clear the flag after acting on it
  if (logoutAt) localStorage.removeItem("af_logout_at");
}

// Case D: Extension popup signed out → chrome.storage.local.session cleared.
// The storage event only fires cross-tab, so the current web app tab won't
// detect it. We listen to chrome.storage.onChanged and dispatch af_logout
// as a custom window event so Providers.tsx can call clearAuth() immediately.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes["session"]) return;
  if (!changes["session"].newValue && changes["session"].oldValue) {
    // Extension session was just removed (popup logout or sync) →
    // clear web app session and notify Zustand
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("af_token");
    window.dispatchEvent(new CustomEvent("af_logout"));
  }
  if (changes["session"].newValue && !changes["session"].oldValue) {
    // Extension session was set (extension login) → sync to web app
    try {
      const s = changes["session"].newValue as SyncSession;
      if (s?.token && !isExpired(s)) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(s));
        localStorage.setItem("af_token", s.token);
        window.dispatchEvent(new CustomEvent("af_auth_sync", { detail: s }));
      }
    } catch { /* ignore */ }
  }
});
