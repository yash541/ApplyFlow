"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 8; // ~12s total safety net

export function UpgradeSuccessToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get("upgraded") !== "true") return;

    setVisible(true);

    const removeParam = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("upgraded");
      router.replace(url.pathname + (url.search || ""), { scroll: false });
    };

    // Step 1: call /billing/sync-plan immediately — directly verifies with Stripe
    // and updates the plan in DB without relying on the webhook at all.
    // This makes the upgrade flow bulletproof even if the webhook fails.
    api.billing.syncPlan().catch(() => {
      // sync failed (network, cold start) — fall through to polling below
    });

    // Step 2: poll billing-usage until plan === "pro", then clean up URL.
    // ?upgraded=true stays in the URL while polling so UsageBanner stays
    // hidden — prevents the contradictory "limit reached" banner.
    let pollTimer: ReturnType<typeof setTimeout>;
    let attempts = 0;

    const poll = async () => {
      attempts++;
      await queryClient.refetchQueries({ queryKey: ["billing-usage"] });
      const cached = queryClient.getQueryData<{ plan?: string }>(["billing-usage"]);
      if (cached?.plan === "pro" || attempts >= MAX_POLL_ATTEMPTS) {
        removeParam();
      } else {
        pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    // Small initial delay so syncPlan() has time to update DB before first poll
    pollTimer = setTimeout(poll, 600);

    const dismiss = setTimeout(() => setVisible(false), 7000);
    return () => {
      clearTimeout(pollTimer);
      clearTimeout(dismiss);
    };
  }, [searchParams, router, queryClient]);

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 animate-fade-in">
      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
      <div className="flex-1">
        <p className="text-label-sm font-semibold text-emerald-300">
          Welcome to ApplyFlow Pro!
        </p>
        <p className="text-label-xs text-emerald-400/70">
          Your plan has been upgraded. All limits are now removed.
        </p>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="rounded p-1 text-emerald-400/60 hover:text-emerald-300 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
