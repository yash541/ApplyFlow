"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { UpgradeModal } from "@/components/shared/UpgradeModal";
import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";
import { setupSyncListener } from "@/lib/sync-channel";

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { showUpgrade, upgradeReason, closeUpgrade } = useUpgradePrompt();
  const queryClient = useQueryClient();

  // Listen for cross-tab broadcasts and invalidate the affected query keys
  useEffect(() => setupSyncListener(queryClient), [queryClient]);

  return (
    <div className="flex h-screen overflow-hidden bg-background mesh-bg">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      {/* Global upgrade modal — available on every dashboard page */}
      <UpgradeModal open={showUpgrade} onClose={closeUpgrade} reason={upgradeReason ?? undefined} />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </AuthGuard>
  );
}
