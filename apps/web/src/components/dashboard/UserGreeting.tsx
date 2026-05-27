"use client";

import { GradientText } from "@applyflow/ui";
import { useAuthStore } from "@/store/auth";

export function UserGreeting() {
  const user = useAuthStore((s) => s.user);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <>
      {greeting}, <GradientText>{user?.name ?? "there"}</GradientText> 👋
    </>
  );
}
