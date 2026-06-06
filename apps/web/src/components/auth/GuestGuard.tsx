"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

/**
 * Redirects already-authenticated users away from auth pages (login, signup).
 *
 * Cases:
 *  - No token              → show the page (login/signup form)
 *  - Expired session       → clear auth, show the page
 *  - Token + unverified    → redirect to /verify-email
 *  - Token + verified      → redirect to /dashboard
 */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router    = useRouter();
  const token     = useAuthStore((s) => s.token);
  const user      = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [hydrated, setHydrated]     = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated || !token) return;

    // If session has expired, clear stale token so the login form renders
    try {
      const raw = localStorage.getItem("af_session");
      if (raw) {
        const session = JSON.parse(raw) as { expiresAt?: string };
        if (session.expiresAt && Date.now() > new Date(session.expiresAt).getTime()) {
          clearAuth();
          return;
        }
      }
    } catch { /* ignore malformed */ }

    // Authenticated but unverified → go to verify-email
    if (user && user.email_verified === false) {
      setRedirecting(true);
      router.replace("/verify-email");
      return;
    }

    // Fully authenticated → go to dashboard
    setRedirecting(true);
    router.replace("/dashboard");
  }, [hydrated, token, user, router, clearAuth]);

  if (!hydrated) return null;

  // Show nothing while redirect is in flight
  if (redirecting) return null;

  // Valid token but redirect hasn't been decided yet (between hydration and effect)
  if (token) return null;

  return <>{children}</>;
}
