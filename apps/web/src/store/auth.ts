"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        // Clear any stale logout flag so auth-bridge doesn't wipe the new session
        localStorage.removeItem("af_logout_at");
        localStorage.setItem("af_token", token);
        const session = {
          token,
          user: { ...user, plan: "free", createdAt: new Date().toISOString() },
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        };
        // af_session is read by the extension's auth-bridge for SSO sync
        localStorage.setItem("af_session", JSON.stringify(session));
        // storage event doesn't fire for same-tab changes — dispatch custom event instead
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("af_login", { detail: session }));
        }
        set({ user, token });
      },
      clearAuth: () => {
        localStorage.removeItem("af_token");
        localStorage.removeItem("af_session");

        // Notify the auth-bridge content script in the same tab
        // (storage event doesn't fire for same-tab changes)
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("af_logout"));
        }

        // Belt-and-suspenders: also set a logout_at timestamp in localStorage.
        // auth-bridge checks this on every page load, so even if the tab unloads
        // before the custom event is handled, the next page load clears the session.
        localStorage.setItem("af_logout_at", Date.now().toString());

        set({ user: null, token: null });
      },
    }),
    { name: "af_auth" },
  ),
);
