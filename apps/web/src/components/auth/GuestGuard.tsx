"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

/**
 * Redirects already-authenticated users away from auth pages (login, signup).
 * Industry standard: visiting /login while logged in → go to /dashboard.
 * Mirrors AuthGuard which does the reverse (unauthenticated → /login).
 */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !token) return;

    // Verify session hasn't expired before redirecting
    try {
      const raw = localStorage.getItem("af_session");
      if (raw) {
        const session = JSON.parse(raw) as { expiresAt?: string };
        if (session.expiresAt && Date.now() > new Date(session.expiresAt).getTime()) {
          return; // expired — let them log in again
        }
      }
    } catch { /* ignore malformed */ }

    // Don't redirect unverified users — AuthGuard will handle sending them to /verify-email
    const user = useAuthStore.getState().user;
    if (user && user.email_verified === false) return;

    router.replace("/dashboard");
  }, [hydrated, token, router]);

  // Show nothing until hydration completes to prevent flash of auth form
  if (!hydrated) return null;
  // Authenticated and valid → show nothing while redirect fires
  if (token) return null;

  return <>{children}</>;
}
