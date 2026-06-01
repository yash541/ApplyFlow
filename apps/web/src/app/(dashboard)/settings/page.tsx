import Link from "next/link";
import { CreditCard, Plug } from "lucide-react";
import { JobApiSettings } from "@/components/settings/JobApiSettings";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-headline-md font-display font-bold text-on-surface">Settings</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">Configure integrations and preferences.</p>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/settings/billing"
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-primary/30 hover:bg-primary/5 transition-all"
        >
          <CreditCard className="h-5 w-5 text-primary" />
          <div>
            <p className="text-label-sm font-semibold text-on-surface">Billing</p>
            <p className="text-label-xs text-on-surface-variant">Plan &amp; usage</p>
          </div>
        </Link>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <Plug className="h-5 w-5 text-on-surface-variant/50" />
          <div>
            <p className="text-label-sm font-semibold text-on-surface">Integrations</p>
            <p className="text-label-xs text-on-surface-variant">Job API keys</p>
          </div>
        </div>
      </div>

      <JobApiSettings />
    </div>
  );
}
