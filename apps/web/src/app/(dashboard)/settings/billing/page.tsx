import { Metadata } from "next";
import { BillingSettings } from "@/components/settings/BillingSettings";

export const metadata: Metadata = { title: "Billing — ApplyFlow" };

export default function BillingPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-headline-md font-display font-bold text-on-surface">Billing</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Manage your plan and usage.
        </p>
      </div>
      <BillingSettings />
    </div>
  );
}
