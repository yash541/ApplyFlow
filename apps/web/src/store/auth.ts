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
        localStorage.setItem("af_token", token);
        set({ user, token });
      },
      clearAuth: () => {
        localStorage.removeItem("af_token");
        set({ user: null, token: null });
      },
    }),
    { name: "af_auth" },
  ),
);
