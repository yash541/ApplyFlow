"use client";

import { useState } from "react";
import { X, Zap, Check, Sparkles, RefreshCw, FileText, Target, Brain } from "lucide-react";
import { api } from "@/lib/api";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

const REASON_MESSAGES: Record<string, string> = {
  resume_downloads:   "You've used all 3 free resume downloads. Upgrade to Pro for unlimited downloads.",
  autofill_sessions:  "You've used all 10 free autofill sessions this month. Upgrade to Pro for unlimited autofills.",
  match_scores:       "You've used all 15 free match scores this month. Upgrade to Pro for unlimited scoring.",
  resume_tailoring:   "AI resume tailoring is a Pro feature. Upgrade to tailor resumes for any job.",
};

const PRO_FEATURES = [
  { icon: Zap,        label: "Unlimited AI autofill sessions" },
  { icon: Target,     label: "Unlimited job match scores" },
  { icon: FileText,   label: "Unlimited resume downloads" },
  { icon: Brain,      label: "AI resume tailoring & ATS scorer" },
  { icon: RefreshCw,  label: "AI field regeneration" },
  { icon: Sparkles,   label: "Profile AI rewrite" },
];

const MONTHLY_PRICE_ID =
  process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID ??
  "price_1Tdaea42KJyHIqXTPKiZyzo9";
const ANNUAL_PRICE_ID =
  process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID ??
  "price_1Tdaea42KJyHIqXTVXjV7gye";

export function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const [loading, setLoading] = useState<"monthly" | "annual" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleCheckout(plan: "monthly" | "annual") {
    setLoading(plan);
    setError(null);
    try {
      const priceId = plan === "monthly" ? MONTHLY_PRICE_ID : ANNUAL_PRICE_ID;
      const { url } = await api.billing.createCheckout(priceId);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg glass-panel rounded-2xl border border-white/10 p-6 shadow-2xl animate-fade-in">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-on-surface-variant/60 hover:bg-white/5 hover:text-on-surface transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-title-lg font-display font-bold text-on-surface">
              Upgrade to ApplyFlow Pro
            </h2>
            <p className="text-label-sm text-on-surface-variant">
              Unlock the full power of AI-assisted job search
            </p>
          </div>
        </div>

        {/* Reason banner — map internal codes to human-readable messages */}
        {reason && (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-label-sm text-amber-400">
            {REASON_MESSAGES[reason] ?? reason}
          </div>
        )}

        {/* Feature list */}
        <ul className="mt-5 grid grid-cols-1 gap-2">
          {PRO_FEATURES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <Check className="h-3 w-3 text-primary" />
              </div>
              <span className="text-body-sm text-on-surface-variant">{label}</span>
            </li>
          ))}
        </ul>

        {/* Pricing cards */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {/* Monthly */}
          <button
            onClick={() => handleCheckout("monthly")}
            disabled={loading !== null}
            className="relative flex flex-col items-center rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <span className="text-label-sm text-on-surface-variant mb-1">Monthly</span>
            <span className="text-headline-sm font-display font-bold text-on-surface">$12</span>
            <span className="text-label-xs text-on-surface-variant/60 mt-0.5">per month</span>
            {loading === "monthly" && (
              <span className="mt-2 text-label-xs text-primary animate-pulse">Redirecting...</span>
            )}
          </button>

          {/* Annual */}
          <button
            onClick={() => handleCheckout("annual")}
            disabled={loading !== null}
            className="relative flex flex-col items-center rounded-xl border border-primary/40 bg-primary/5 p-4 text-center hover:border-primary/70 hover:bg-primary/10 transition-all disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
              SAVE 31%
            </span>
            <span className="text-label-sm text-on-surface-variant mb-1">Annual</span>
            <span className="text-headline-sm font-display font-bold text-on-surface">$99</span>
            <span className="text-label-xs text-on-surface-variant/60 mt-0.5">per year</span>
            {loading === "annual" && (
              <span className="mt-2 text-label-xs text-primary animate-pulse">Redirecting...</span>
            )}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-label-sm text-red-400 text-center">{error}</p>
        )}

        <p className="mt-4 text-center text-label-xs text-on-surface-variant/50">
          Secure payment via Stripe · Cancel anytime
        </p>
      </div>
    </div>
  );
}
