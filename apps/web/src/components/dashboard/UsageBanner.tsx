"use client";

import { useEffect, useState } from "react";
import { Zap, ArrowRight } from "lucide-react";
import { api, UsageData } from "@/lib/api";
import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";

export function UsageBanner() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const openUpgrade = useUpgradePrompt((s) => s.openUpgrade);

  useEffect(() => {
    api.billing.getUsage().then(setUsage).catch(() => null);
  }, []);

  // Only show for free users when usage exceeds 50% on any meter
  if (!usage || usage.plan === "pro") return null;

  const autofillPct = usage.autofill_limit
    ? (usage.autofill_used / usage.autofill_limit) * 100
    : 0;
  const scorePct = usage.score_limit
    ? (usage.score_used / usage.score_limit) * 100
    : 0;

  const showBanner = autofillPct > 50 || scorePct > 50;
  if (!showBanner) return null;

  // Pick the most-used metric for the banner text
  const primary =
    autofillPct >= scorePct
      ? {
          label: "autofills",
          used: usage.autofill_used,
          limit: usage.autofill_limit!,
        }
      : {
          label: "match scores",
          used: usage.score_used,
          limit: usage.score_limit!,
        };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
      <Zap className="h-4 w-4 shrink-0 text-amber-400" />
      <p className="flex-1 text-label-sm text-amber-300/90">
        {primary.used} of {primary.limit} free {primary.label} used this month
      </p>
      <button
        onClick={() => openUpgrade("Upgrade for unlimited autofill, match scores, and more.")}
        className="flex shrink-0 items-center gap-1 text-label-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
      >
        Upgrade for unlimited
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
