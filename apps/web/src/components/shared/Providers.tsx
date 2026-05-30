"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";

/** Handles cross-tab auth sync:
 *  - Login in another tab  → auto-login this tab  (af_login event or storage change)
 *  - Logout in another tab → auto-logout this tab (storage event: af_session removed)
 *  - Extension SSO sync    → auto-login this tab  (af_auth_sync custom event)
 */
function ExtensionAuthSync() {
  const { user, token, setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    // ── Initial hydration from extension session ──────────────────────────────
    if (!user) {
      const raw = localStorage.getItem("af_session");
      if (raw) {
        try {
          const s = JSON.parse(raw) as { token: string; user: { id: string; name: string; email: string }; expiresAt: string };
          if (s.token && new Date(s.expiresAt).getTime() > Date.now()) {
            setAuth(s.user, s.token);
          }
        } catch { /* ignore */ }
      }
    }

    // ── Cross-tab logout sync ─────────────────────────────────────────────────
    // When the user logs out in ANOTHER tab, storage event fires here.
    // Zustand state in this tab still has the old token — we must clear it
    // so AuthGuard detects token=null and redirects to /login.
    function onStorage(e: StorageEvent) {
      if (e.key === "af_session" && !e.newValue && token) {
        // af_session was removed in another tab → log out this tab too
        clearAuth();
      }
      if (e.key === "af_session" && e.newValue && !token) {
        // af_session was set in another tab (login) → log in this tab too
        try {
          const s = JSON.parse(e.newValue) as { token: string; user: { id: string; name: string; email: string }; expiresAt: string };
          if (s.token) setAuth(s.user, s.token);
        } catch { /* ignore */ }
      }
    }
    window.addEventListener("storage", onStorage);

    // ── Extension SSO sync (same-tab, via auth-bridge custom event) ───────────
    function onSync(e: Event) {
      const s = (e as CustomEvent<{ token: string; user: { id: string; name: string; email: string }; expiresAt: string }>).detail;
      if (s?.token) setAuth(s.user, s.token);
    }
    window.addEventListener("af_auth_sync", onSync);

    // ── Extension popup logout → auth-bridge dispatches af_logout ─────────────
    // chrome.storage.onChanged fires in auth-bridge which dispatches this event,
    // allowing same-tab Zustand state to clear without needing a storage event.
    function onExtLogout() { clearAuth(); }
    window.addEventListener("af_logout", onExtLogout);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("af_auth_sync", onSync);
      window.removeEventListener("af_logout", onExtLogout);
    };
  }, [user, token, setAuth, clearAuth]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ExtensionAuthSync />
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
