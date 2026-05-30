import { JobApiSettings } from "@/components/settings/JobApiSettings";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-headline-md font-display font-bold text-on-surface">Settings</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">Configure integrations and preferences.</p>
      </div>
      <JobApiSettings />
    </div>
  );
}
