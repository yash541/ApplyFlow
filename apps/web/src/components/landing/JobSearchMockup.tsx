"use client";

import { motion } from "framer-motion";

const JOBS = [
  { title: "Software Engineer", company: "Stripe", location: "Remote", salary: "$150K–$180K", match: 91, source: "JSearch" },
  { title: "Frontend Engineer", company: "Linear", location: "SF / Remote", salary: "$130K–$160K", match: 87, source: "Adzuna" },
  { title: "Full Stack Developer", company: "Notion", location: "NYC", salary: "$125K–$155K", match: 82, source: "Apify" },
];

export function JobSearchMockup() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(15,15,26,0.8)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 0 40px rgba(0,0,0,0.4)",
      }}
    >
      {/* Search bar */}
      <div
        className="p-3 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <span className="text-xs text-white/30">Software Engineer · Remote</span>
          <div className="ml-auto flex gap-1">
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">JSearch</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">Adzuna</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">Apify</span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-white/30">247 results streaming…</span>
          <div className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1 h-1 rounded-full bg-indigo-400"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        </div>

        {JOBS.map((job, i) => (
          <motion.div
            key={job.title + job.company}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12, duration: 0.3 }}
            className="p-3 rounded-lg flex items-start gap-3 cursor-pointer hover:bg-white/[0.04] transition-colors"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {/* Company initial */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: `hsl(${i * 40 + 220}, 70%, 40%)` }}
            >
              {job.company[0]}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-white truncate">{job.title}</div>
                  <div className="text-[11px] text-white/40 mt-0.5">
                    {job.company} · {job.location}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div
                    className="text-xs font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background:
                        job.match >= 90
                          ? "rgba(16,185,129,0.15)"
                          : "rgba(99,102,241,0.15)",
                      color: job.match >= 90 ? "#34d399" : "#a5b4fc",
                    }}
                  >
                    {job.match}%
                  </div>
                  <div className="text-[10px] text-white/25 mt-1">{job.salary}</div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
