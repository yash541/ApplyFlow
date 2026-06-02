"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { UpgradeModal } from "@/components/shared/UpgradeModal";
import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { showUpgrade, upgradeReason, closeUpgrade } = useUpgradePrompt();
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
