"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FIELDS = [
  { label: "First Name", value: "Yashwanth", status: "ai" },
  { label: "Last Name", value: "Avula", status: "ai" },
  { label: "Email", value: "yash@example.com", status: "ai" },
  { label: "Phone", value: "+91 799 ••• ••••", status: "ai" },
  { label: "LinkedIn URL", value: "linkedin.com/in/yash", status: "manual" },
  { label: "Years of Exp.", value: "3 years", status: "ai" },
];

export function ExtensionPanelMockup() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [typing, setTyping] = useState<number | null>(null);

  useEffect(() => {
    if (visibleCount >= FIELDS.length) {
      // Reset after a pause
      const resetTimer = setTimeout(() => {
        setVisibleCount(0);
        setTyping(null);
      }, 3500);
      return () => clearTimeout(resetTimer);
    }

    const showNext = setTimeout(() => {
      setTyping(visibleCount);
      const revealTimer = setTimeout(() => {
        setVisibleCount((c) => c + 1);
        setTyping(null);
      }, 500);
      return () => clearTimeout(revealTimer);
    }, 700);

    return () => clearTimeout(showNext);
  }, [visibleCount]);

  return (
    <div className="relative">
      {/* Glow behind card */}
      <div className="absolute -inset-4 bg-indigo-600/10 rounded-3xl blur-2xl" />

      {/* Main card */}
      <div
        className="relative w-[380px] rounded-2xl overflow-hidden"
        style={{
          background: "rgba(15,15,26,0.95)",
          border: "1px solid rgba(99,102,241,0.25)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(99,102,241,0.1)",
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between border-b"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs">
              ⚡
            </div>
            <span className="text-sm font-semibold text-white">
              ApplyFlow — Review &amp; Fill
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-white/40">Active</span>
          </div>
        </div>

        {/* Job context bar */}
        <div
          className="px-4 py-2.5 border-b flex items-center gap-2"
          style={{
            background: "rgba(99,102,241,0.06)",
            borderColor: "rgba(255,255,255,0.05)",
          }}
        >
          <span className="text-xs text-indigo-300 font-medium">
            🎯 Greenhouse · Software Engineer @ Vercel
          </span>
        </div>

        {/* Fields */}
        <div className="px-4 py-3 space-y-2 min-h-[280px]">
          <AnimatePresence>
            {FIELDS.slice(0, visibleCount).map((field, i) => (
              <motion.div
                key={field.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg"
                style={{
                  background:
                    field.status === "ai"
                      ? "rgba(99,102,241,0.08)"
                      : "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {/* Checkbox */}
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                    field.status === "ai"
                      ? "bg-indigo-500"
                      : "border border-white/20"
                  }`}
                >
                  {field.status === "ai" && (
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path
                        d="M1 3L3 5L7 1"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>

                {/* Label */}
                <span className="text-xs text-white/50 w-[100px] flex-shrink-0">
                  {field.label}
                </span>

                {/* AI badge */}
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                    field.status === "ai"
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  {field.status === "ai" ? "AI ✓" : "Manual"}
                </span>

                {/* Value */}
                <span
                  className="text-xs text-white font-medium flex-1 text-right truncate"
                  style={{ fontFamily: "JetBrains Mono, monospace" }}
                >
                  {typing === i ? (
                    <TypewriterText text={field.value} />
                  ) : (
                    field.value
                  )}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Streaming indicator */}
          {typing !== null && (
            <div className="flex items-center gap-1.5 py-1 px-2">
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
              <span className="text-xs text-indigo-400/70">AI filling…</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-3 flex items-center justify-between border-t"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          <span className="text-xs text-white/30">
            {visibleCount} / {FIELDS.length} fields ready
          </span>
          <button
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 transition-all shadow-[0_0_12px_rgba(99,102,241,0.4)]"
          >
            Fill {Math.min(visibleCount, FIELDS.length - 1)} fields →
          </button>
        </div>
      </div>

      {/* Floating score badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        className="absolute -right-8 top-12 px-3 py-2 rounded-xl text-xs font-semibold"
        style={{
          background: "rgba(16, 185, 129, 0.15)",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          color: "#34d399",
        }}
      >
        <div className="flex items-center gap-1.5">
          <span>Match Score</span>
          <span className="text-base font-bold">83%</span>
        </div>
      </motion.div>
    </div>
  );
}

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span>
      {displayed}
      <span className="animate-pulse text-indigo-400">|</span>
    </span>
  );
}
