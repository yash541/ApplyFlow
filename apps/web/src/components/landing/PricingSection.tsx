"use client";

import { motion } from "framer-motion";
import { Check, X, Zap, Crown } from "lucide-react";
import Link from "next/link";

const FREE_FEATURES = [
  { label: "Chrome extension + job overlay", note: "" },
  { label: "AI autofill sessions", note: "10 / month" },
  { label: "Job match score", note: "10 / month" },
  { label: "Applications Kanban board", note: "Unlimited" },
  { label: "Submission auto-detection", note: "" },
  { label: "Real-time notifications", note: "" },
  { label: "Job search", note: "JSearch + Adzuna + Apify" },
  { label: "1 base resume upload", note: "" },
  { label: "1 resume download", note: "lifetime total" },
];

const PRO_FEATURES = [
  { label: "Everything in Free", note: "" },
  { label: "Unlimited AI autofills", note: "" },
  { label: "Unlimited job match scoring", note: "" },
  { label: "AI resume tailoring", note: "Job-linked + General" },
  { label: "General Resumes library", note: "Save by role type, download anytime" },
  { label: "Unlimited resume downloads", note: "" },
  { label: "AI field regeneration (↺)", note: "" },
  { label: "Profile AI rewrite", note: "Summary + bullets" },
  { label: "Save-to-profile learning", note: "" },
  { label: "Cross-portal session continuity", note: "" },
  { label: "Resume Lab zoom", note: "" },
  { label: "ATS score on resume", note: "" },
];

function FeatureRow({ label, note, included }: { label: string; note: string; included: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
      <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5
        ${included ? "bg-indigo-500/20" : "bg-white/5"}`}>
        {included
          ? <Check className="h-3 w-3 text-indigo-400" />
          : <X className="h-3 w-3 text-white/20" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${included ? "text-white/80" : "text-white/30"}`}>{label}</span>
        {note && (
          <span className="ml-2 text-[11px] text-white/40 font-medium">{note}</span>
        )}
      </div>
    </div>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" className="py-32 relative">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-600/6 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-5xl mx-auto px-6 relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/8 text-indigo-300 text-xs font-semibold mb-4">
            Simple pricing
          </div>
          <h2 className="text-4xl font-bold text-white mb-4">
            Start free. Upgrade when you&apos;re ready.
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            The free plan is genuinely useful. Upgrade when you hit the limits of a serious job search.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

          {/* Free */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-white/8 bg-white/[0.03] p-7 flex flex-col"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center">
                <Zap className="h-4.5 w-4.5 text-white/60" />
              </div>
              <span className="text-base font-semibold text-white/80">Free</span>
            </div>
            <div className="mb-1">
              <span className="text-4xl font-bold text-white">$0</span>
            </div>
            <p className="text-sm text-white/40 mb-6">Forever free. No credit card required.</p>

            <div className="flex-1 space-y-0 mb-8">
              {FREE_FEATURES.map(f => (
                <FeatureRow key={f.label} label={f.label} note={f.note} included={true} />
              ))}
            </div>

            <Link
              href="/login"
              className="w-full h-11 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-semibold transition-all flex items-center justify-center"
            >
              Get started free
            </Link>
          </motion.div>

          {/* Pro */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl border border-indigo-500/40 bg-gradient-to-b from-indigo-500/10 to-indigo-500/[0.03] p-7 flex flex-col relative overflow-hidden"
          >
            {/* Most popular badge */}
            <div className="absolute top-0 right-6 -translate-y-px">
              <div className="px-3 py-1 rounded-b-lg bg-indigo-500 text-white text-[11px] font-bold tracking-wide">
                MOST POPULAR
              </div>
            </div>

            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Crown className="h-4.5 w-4.5 text-indigo-300" />
              </div>
              <span className="text-base font-semibold text-white">Pro</span>
            </div>

            <div className="mb-1 flex items-end gap-2">
              <span className="text-4xl font-bold text-white">$12</span>
              <span className="text-white/50 text-sm mb-1.5">/month</span>
            </div>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-sm text-emerald-400 font-medium">$99/year</span>
              <span className="text-xs text-white/30">— save 31%</span>
            </div>

            <div className="flex-1 space-y-0 mb-8">
              {PRO_FEATURES.map(f => (
                <FeatureRow key={f.label} label={f.label} note={f.note} included={true} />
              ))}
            </div>

            <Link
              href="/login"
              className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <Crown className="h-4 w-4" />
              Start with Pro
            </Link>
            <p className="text-center text-xs text-white/30 mt-3">Cancel anytime · No hidden fees</p>
          </motion.div>
        </div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center text-sm text-white/30 mt-10"
        >
          Average active Pro user costs us ~$1.80/month in AI — the rest funds product development.
        </motion.p>
      </div>
    </section>
  );
}
