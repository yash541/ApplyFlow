"use client";

import { motion } from "framer-motion";

const BULLETS_BEFORE = [
  "Worked on React components for the dashboard",
  "Helped with backend API development using Node.js",
  "Fixed bugs and improved performance",
];

const BULLETS_AFTER = [
  "Built 12+ reusable React components reducing dev time by 35%",
  "Architected RESTful APIs serving 50K+ daily requests with 99.9% uptime",
  "Optimized critical rendering paths, cutting LCP from 4.2s to 1.1s",
];

export function ResumeMockup() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(15,15,26,0.8)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 0 40px rgba(0,0,0,0.4)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center gap-2 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <span className="text-xs font-semibold text-white/60">Resume Tailoring</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
          ATS-Optimized
        </span>
      </div>

      <div className="flex">
        {/* Before */}
        <div className="flex-1 p-4 border-r" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">
            Before
          </div>
          <div className="space-y-2">
            {BULLETS_BEFORE.map((bullet, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
                className="flex gap-2"
              >
                <span className="text-white/20 text-xs mt-0.5 flex-shrink-0">•</span>
                <span className="text-[11px] text-white/35 leading-relaxed">{bullet}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* After */}
        <div className="flex-1 p-4" style={{ background: "rgba(99,102,241,0.04)" }}>
          <div className="text-[10px] font-semibold text-indigo-400/60 uppercase tracking-wider mb-3">
            After AI ✨
          </div>
          <div className="space-y-2">
            {BULLETS_AFTER.map((bullet, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.12, duration: 0.35 }}
                className="flex gap-2"
              >
                <span className="text-indigo-400 text-xs mt-0.5 flex-shrink-0">•</span>
                <span className="text-[11px] text-white/75 leading-relaxed font-medium">
                  {bullet}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
