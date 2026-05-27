import { Metadata } from "next";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { RecentApplications } from "@/components/dashboard/RecentApplications";
import { AutofillProfilePanel } from "@/components/dashboard/AutofillProfilePanel";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { UserGreeting } from "@/components/dashboard/UserGreeting";

export const metadata: Metadata = { title: "Home — ApplyFlow" };

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-headline-md font-display font-bold text-on-surface">
          <UserGreeting />
        </h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Here&apos;s your job search overview.
        </p>
      </div>

      <StatsRow />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RecentApplications />
          <QuickActions />
        </div>
        <div>
          <AutofillProfilePanel />
        </div>
      </div>
    </div>
  );
}
