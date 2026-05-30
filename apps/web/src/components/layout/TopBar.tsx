"use client";

import { Search, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@applyflow/ui";
import { useAuthStore } from "@/store/auth";
import { NotificationBell } from "./NotificationBell";

export function TopBar() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  function handleLogout() {
    clearAuth();
    router.push("/login");
  }

  return (
    <header className="h-14 shrink-0 flex items-center px-6 gap-4 border-b border-white/5 glass-panel">
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-variant/50" />
          <input
            type="text"
            placeholder="Search jobs, resumes..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-surface-container/60 border border-outline-variant/40
                       text-body-sm text-on-surface placeholder:text-on-surface-variant/40
                       focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20
                       transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <NotificationBell />

        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span className="text-xs text-primary font-medium">
              {user?.name?.charAt(0).toUpperCase() ?? "?"}
            </span>
          </div>
          {user && (
            <span className="text-body-sm text-on-surface-variant hidden sm:block">{user.name}</span>
          )}
        </div>

        <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
