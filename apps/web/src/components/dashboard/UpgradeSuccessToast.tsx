"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const POLL_INTERVAL_MS = 1200;
const MAX_POLL_ATTEMPTS = 6; // ~7s total — enough for Stripe webhook to land

export function UpgradeSuccessToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get("upgraded") !== "true") return;

    setVisible(true);
    // Invalidate immediately so any background refetch picks up fresh data
    queryClient.invalidateQueries({ queryKey: ["billing-usage"] });

    // Poll billing-usage until the plan flips to "pro", THEN remove ?upgraded=true.
    // Keeping the param in the URL prevents UsageBanner from rendering during
    // the webhook processing window — avoids the contradictory "limit reached"
    // banner appearing right next to the "Welcome to Pro!" message.
    let pollTimer: ReturnType<typeof setTimeout>;
    let attempts = 0;

    const removeParam = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("upgraded");
      router.replace(url.pathname + (url.search || ""), { scroll: false });
    };

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

    // First check after a short delay — gives the webhook a head start
    pollTimer = setTimeout(poll, 800);

    const dismiss = setTimeout(() => setVisible(false), 6000);
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
