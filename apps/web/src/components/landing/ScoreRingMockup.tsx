"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TARGET = 83;

export function ScoreRingMockup() {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: "-100px" });

  useEffect(() => {
    if (!inView) {
      setCount(0);
      return;
    }

    let start = 0;
    const duration = 1800;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(eased * TARGET);
      setCount(value);
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [inView]);

  const strokeDashoffset = CIRCUMFERENCE - (count / 100) * CIRCUMFERENCE;

  return (
    <div
      ref={ref}
      className="flex flex-col items-center justify-center p-10 rounded-2xl"
      style={{
        background: "rgba(15,15,26,0.8)",
        border: "1px solid rgba(99,102,241,0.2)",
        boxShadow: "0 0 40px rgba(99,102,241,0.08)",
      }}
    >
      {/* SVG Ring */}
      <div className="relative w-40 h-40">
        <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
          {/* Track */}
          <circle
            cx="80"
            cy="80"
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="10"
          />
          {/* Progress */}
          <motion.circle
            cx="80"
            cy="80"
            r={RADIUS}
            fill="none"
            stroke="url(#scoreGradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            style={{
              filter: "drop-shadow(0 0 8px rgba(99,102,241,0.8))",
              transition: "stroke-dashoffset 0.05s linear",
            }}
          />
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-white">{count}</span>
          <span className="text-xs font-semibold text-white/30 tracking-widest uppercase mt-0.5">
            MATCH
          </span>
        </div>
      </div>

      {/* Match tier */}
      <div className="mt-4 flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/25">
        <span className="text-sm">🔵</span>
        <span className="text-sm font-semibold text-indigo-300">Good Match</span>
      </div>

      {/* Score breakdown */}
      <div className="mt-5 w-full space-y-2.5">
        {[
          { label: "Skills", score: 91 },
          { label: "Experience", score: 78 },
          { label: "Title Fit", score: 85 },
          { label: "Education", score: 72 },
        ].map(({ label, score }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="text-xs text-white/40 w-20 flex-shrink-0">{label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: inView ? `${score}%` : "0%" }}
                transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
              />
            </div>
            <span className="text-xs text-white/50 w-8 text-right">{score}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
