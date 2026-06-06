"use client";

import { motion } from "framer-motion";

const PORTALS = [
  "LinkedIn",
  "Greenhouse",
  "Lever",
  "Workday",
  "Indeed",
  "Glassdoor",
  "Ashby",
  "BambooHR",
  "SmartRecruiters",
  "Wellfound",
  "iCIMS",
  "Jobvite",
  "Naukri",
  "Cutshort",
];

export function SocialProofBar() {
  return (
    <section className="py-12 border-y border-white/[0.06]" style={{ background: "rgba(255,255,255,0.015)" }}>
      <div className="max-w-7xl mx-auto px-6 space-y-4">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <span className="text-sm font-medium text-white/40 flex-shrink-0 whitespace-nowrap">
            Autofills forms on:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {PORTALS.map((portal, i) => (
              <motion.span
                key={portal}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                className="px-3 py-1 rounded-full text-xs font-medium text-white/60 border border-white/[0.1] bg-white/[0.04] hover:border-indigo-500/40 hover:text-white/80 hover:bg-indigo-500/10 transition-all duration-200 cursor-default"
              >
                {portal}
              </motion.span>
            ))}
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-indigo-400 border border-indigo-500/30 bg-indigo-500/10">
              +20 more
            </span>
          </div>
        </motion.div>

        {/* Powered by bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <span className="text-sm font-medium text-white/40 flex-shrink-0">Powered by:</span>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "Claude AI (Anthropic)", color: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
              { label: "Stripe Billing", color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10" },
              { label: "Resend Email", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
            ].map((item) => (
              <span
                key={item.label}
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${item.color}`}
              >
                {item.label}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
