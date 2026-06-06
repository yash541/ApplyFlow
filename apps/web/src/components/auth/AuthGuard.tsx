"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user  = useAuthStore((s) => s.user);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace("/login"); return; }
    if (user && user.email_verified === false) {
      router.replace("/verify-email");
    }
  }, [hydrated, token, user, router]);

  if (!hydrated) return null;
  if (!token) return null;
  if (user && user.email_verified === false) return null;

  return <>{children}</>;
}
