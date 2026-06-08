"use client";

import { useState } from "react";
import { Zap, Check, RefreshCcw, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { UpgradeModal } from "@/components/shared/UpgradeModal";

function UsageMeter({
  label,
  used,
  limit,
  period = "monthly",
}: {
  label: string;
  used: number;
  limit: number | null;
  period?: "monthly" | "lifetime";
}) {
  if (limit === null) {
    return (
      <div className="space-y-1.5">
        <div className="flex justify-between items-baseline text-label-sm">
          <span className="text-on-surface-variant">{label}</span>
          <span className="text-primary font-semibold">Unlimited</span>
        </div>
        <div className="h-1.5 rounded-full bg-primary/20">
          <div className="h-full w-full rounded-full bg-primary/40" />
        </div>
      </div>
    );
  }

  const pct = Math.min((used / limit) * 100, 100);
  const color =
    pct >= 90 ? "bg-red-400" :
    pct >= 60 ? "bg-amber-400" :
    "bg-primary";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline text-label-sm">
        <span className="text-on-surface-variant">{label}</span>
        <div className="flex items-baseline gap-1.5">
          <span className={pct >= 90 ? "text-red-400 font-semibold" : "text-on-surface"}>
            {used} / {limit}
          </span>
          <span className="text-[10px] text-on-surface-variant/40">
            {period === "lifetime" ? "lifetime" : "this month"}
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function BillingSettings() {
  const { data: usage, isLoading: loading } = useQuery({
    queryKey: ["billing-usage"],
    queryFn: () => api.billing.getUsage(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const [syncLoading, setSyncLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  async function handleSync() {
    setSyncLoading(true);
    setSyncMsg(null);
    setError(null);
    try {
      const result = await api.billing.syncPlan();
      if (result.plan === "pro") {
        setSyncMsg("Plan updated to Pro! Refreshing…");
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setSyncMsg("No active Pro subscription found.");
      }
    } catch {
      setError("Could not sync plan. Try again in a moment.");
    } finally {
      setSyncLoading(false);
    }
  }

  async function handleCancel() {
    setCancelLoading(true);
    setError(null);
    try {
      await api.billing.cancelSubscription();
      setCancelMsg("Subscription cancelled. You'll retain Pro access until the end of your billing period.");
      setShowCancelConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel subscription.");
    } finally {
      setCancelLoading(false);
    }
  }

  const isPro     = usage?.plan === "pro";
  const isExpired = usage?.plan === "expired";

  return (
    <>
      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
      />

      <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-6">
        {/* Plan badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant">Current plan</p>
              {loading ? (
                <div className="mt-1 h-5 w-16 rounded bg-white/5 animate-pulse" />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-title-sm font-semibold text-on-surface capitalize">
                    {isExpired ? "Free" : (usage?.plan ?? "Free")}
                  </span>
                  {isPro && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
                      <Check className="h-2.5 w-2.5" /> Pro
                    </span>
                  )}
                  {isExpired && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 uppercase tracking-wide">
                      Expired
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {!loading && !isPro && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-label-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              <Zap className="h-3.5 w-3.5" />
              Upgrade to Pro
            </button>
          )}
        </div>

        {error && (
          <p className="text-label-sm text-red-400">{error}</p>
        )}

        {/* Sync fallback */}
        {!loading && !isPro && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncLoading}
              className="flex items-center gap-1.5 text-label-sm text-on-surface-variant/60 hover:text-on-surface-variant transition-colors disabled:opacity-40"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${syncLoading ? "animate-spin" : ""}`} />
              Already upgraded? Sync plan
            </button>
            {syncMsg && (
              <span className="text-label-sm text-emerald-400">{syncMsg}</span>
            )}
          </div>
        )}

        {/* Usage meters */}
        {!loading && usage && (
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-on-surface-variant/50 uppercase tracking-wider">
                This month&apos;s usage
              </p>
              <UsageMeter
                label="AI Autofill Sessions"
                used={usage.autofill_used}
                limit={usage.autofill_limit}
                period="monthly"
              />
              <UsageMeter
                label="Job Match Scores"
                used={usage.score_used}
                limit={usage.score_limit}
                period="monthly"
              />
              <UsageMeter
                label="AI Resume Tailors"
                used={usage.tailor_used}
                limit={usage.tailor_limit}
                period="monthly"
              />
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-on-surface-variant/50 uppercase tracking-wider">
                Lifetime usage
              </p>
              <UsageMeter
                label="Clean Resume Downloads"
                used={usage.downloads_used}
                limit={usage.downloads_limit}
                period="lifetime"
              />
              {!isPro && usage.downloads_limit !== null && usage.downloads_used >= usage.downloads_limit && (
                <p className="text-[11px] text-amber-400/70 leading-relaxed -mt-1">
                  Further downloads include an ApplyFlow watermark.{" "}
                  <button
                    onClick={() => setShowUpgrade(true)}
                    className="underline underline-offset-2 hover:text-amber-300 transition-colors"
                  >
                    Upgrade to Pro
                  </button>
                  {" "}to remove it.
                </p>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-4 w-40 rounded bg-white/5 animate-pulse" />
                <div className="h-1.5 w-full rounded-full bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Cancel subscription (Pro users only) */}
        {!loading && isPro && (
          <div className="pt-2 border-t border-white/5">
            {cancelMsg ? (
              <p className="text-label-sm text-emerald-400">{cancelMsg}</p>
            ) : showCancelConfirm ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-label-sm text-red-300">
                    Your Pro access continues until the end of the billing period. Are you sure you want to cancel?
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={cancelLoading}
                    className="rounded-lg bg-red-500/20 border border-red-500/30 px-3 py-1.5 text-label-sm text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  >
                    {cancelLoading ? "Cancelling…" : "Yes, cancel"}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-label-sm text-on-surface-variant hover:bg-white/5 transition-colors"
                  >
                    Keep Pro
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="text-label-sm text-on-surface-variant/40 hover:text-on-surface-variant/70 transition-colors"
              >
                Cancel subscription
              </button>
            )}
          </div>
        )}

        {/* Expired plan callout */}
        {!loading && isExpired && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
            <p className="text-label-sm font-semibold text-amber-300">Your Pro subscription has ended</p>
            <p className="text-label-xs text-amber-400/70 leading-relaxed">
              You've already used your free trial. Resubscribe to continue using AI match scoring,
              autofill, and resume downloads.
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-label-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              <Zap className="h-3.5 w-3.5" />
              Resubscribe to Pro
            </button>
          </div>
        )}

        {/* Pro feature callout for free users */}
        {!loading && !isPro && !isExpired && (
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 space-y-2">
            <p className="text-label-sm font-semibold text-primary">What&apos;s included in Pro</p>
            <ul className="space-y-1.5">
              {[
                "Unlimited AI autofill sessions",
                "Unlimited job match scores",
                "Unlimited resume downloads",
                "AI resume tailoring + ATS scorer",
                "AI field regeneration",
                "Profile AI rewrite",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
