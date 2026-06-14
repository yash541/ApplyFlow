import { Metadata } from "next";
import { Suspense } from "react";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { RecentApplications } from "@/components/dashboard/RecentApplications";
import { AutofillProfilePanel } from "@/components/dashboard/AutofillProfilePanel";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { UserGreeting } from "@/components/dashboard/UserGreeting";
import { JobSearchWidget } from "@/components/dashboard/JobSearchWidget";
import { UsageBanner } from "@/components/dashboard/UsageBanner";
import { UpgradeSuccessToast } from "@/components/dashboard/UpgradeSuccessToast";

export const metadata: Metadata = { title: "Home — ApplyFlow" };

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Upgrade success toast */}
      <Suspense fallback={null}>
        <UpgradeSuccessToast />
      </Suspense>

      {/* Header */}
      <div>
        <h1 className="text-headline-md font-display font-bold text-on-surface">
          <UserGreeting />
        </h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Here&apos;s your job search overview.
        </p>
      </div>

      {/* Usage banner for free users (shown when > 50% used) */}
      <UsageBanner />

      {/* Stats */}
      <StatsRow />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — main content */}
        <div className="lg:col-span-2 space-y-6">
          <RecentApplications />
          <QuickActions />
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          <JobSearchWidget />
          <AutofillProfilePanel />
        </div>

      </div>
    </div>
  );
}
