"use client";

import { Zap, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";

export function UsageBanner() {
  const openUpgrade = useUpgradePrompt((s) => s.openUpgrade);
  const searchParams = useSearchParams();

  // Use React Query so UpgradeSuccessToast can invalidate this when payment completes
  const { data: usage } = useQuery({
    queryKey: ["billing-usage"],
    queryFn: () => api.billing.getUsage(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Hide if upgrade just happened (URL has ?upgraded=true) to avoid contradictory banners
  if (searchParams.get("upgraded") === "true") return null;

  // Expired users: show a distinct resubscribe banner
  if (usage?.plan === "expired") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
        <Zap className="h-4 w-4 shrink-0 text-amber-400" />
        <p className="flex-1 text-label-sm text-amber-300/90">
          Your Pro subscription has ended — AI features are paused
        </p>
        <button
          onClick={() => openUpgrade("Resubscribe to Pro to resume AI scoring, autofill, and downloads.")}
          className="flex shrink-0 items-center gap-1 text-label-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
        >
          Resubscribe
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

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
