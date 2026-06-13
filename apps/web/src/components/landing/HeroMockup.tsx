"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LOOP_INTERVAL = 5500; // ms before full replay

// ── Animated counter — restarts when `cycleKey` changes ──────────────────────
function Counter({ target, duration = 1200, cycleKey }: { target: number; duration?: number; cycleKey: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    setVal(0);
    let start: number | null = null;
    let raf: number;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.floor(p * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, cycleKey]);
  return <>{val}</>;
}

// ── Kanban data ───────────────────────────────────────────────────────────────
const COLS = [
  {
    label: "Applied",
    accent: "rgba(99,102,241,0.5)",
    bg: "rgba(99,102,241,0.1)",
    cards: [
      { company: "Vercel",  role: "Product Eng.",    tag: "Applied"  },
      { company: "Notion",  role: "Full Stack Eng.", tag: "Applied"  },
    ],
  },
  {
    label: "Interview",
    accent: "rgba(245,158,11,0.5)",
    bg: "rgba(245,158,11,0.08)",
    cards: [
      { company: "Figma", role: "SWE II", tag: "Screen" },
    ],
  },
  {
    label: "Offered",
    accent: "rgba(16,185,129,0.5)",
    bg: "rgba(16,185,129,0.08)",
    cards: [
      { company: "Linear", role: "Frontend Eng.", tag: "Offer 🎉" },
    ],
  },
];

const AUTOFILL_FIELDS = [
  { label: "Name",  val: "Yashwanth R.",   delay: 0.2  },
  { label: "Email", val: "yash@...",        delay: 0.6  },
  { label: "Role",  val: "Full Stack Dev",  delay: 1.0  },
  { label: "Exp.",  val: "3 years",         delay: 1.4  },
];

export function HeroMockup() {
  const [cycleKey, setCycleKey] = useState(0);

  // Replay all animations on a loop
  useEffect(() => {
    const id = setInterval(() => setCycleKey(k => k + 1), LOOP_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-[420px] h-[440px] select-none">

      {/* Ambient glow */}
      <div className="absolute inset-0 bg-indigo-600/10 rounded-3xl blur-3xl scale-110" />

      {/* ── Main card: Kanban Dashboard ──────────────────────────── */}
      <motion.div
        key={`main-${cycleKey}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="absolute top-14 left-4 right-4 rounded-2xl overflow-hidden"
        style={{
          background: "rgba(10,10,20,0.97)",
          border: "1px solid rgba(99,102,241,0.2)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Chrome bar */}
        <div className="px-4 py-2.5 flex items-center gap-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div className="flex gap-1.5">
            {["#f87171","#fbbf24","#4ade80"].map(c => <div key={c} className="w-2 h-2 rounded-full" style={{ background: c }} />)}
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[9px]">⚡</div>
            <span className="text-[11px] text-white/40 font-medium">ApplyFlow — Applications</span>
          </div>
          <span className="ml-auto text-[10px] text-white/25">8 tracked</span>
        </div>

        {/* Kanban */}
        <div className="p-3 flex gap-2.5">
          {COLS.map((col, ci) => (
            <div key={col.label} className="flex-1 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: col.accent }} />
                <span className="text-[10px] font-semibold text-white/40">{col.label}</span>
                <span className="text-[9px] text-white/20 ml-auto">{col.cards.length}</span>
              </div>
              {col.cards.map((card, i) => (
                <motion.div
                  key={`${card.company}-${cycleKey}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + ci * 0.15 + i * 0.1, duration: 0.35 }}
                  className="p-2 rounded-lg"
                  style={{ background: col.bg, border: `1px solid ${col.accent}` }}
                >
                  <p className="text-[10px] font-bold text-white">{card.company}</p>
                  <p className="text-[9px] text-white/40 mt-0.5">{card.role}</p>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full mt-1.5 inline-block font-semibold"
                    style={{ background: col.bg, color: col.accent.replace("0.5","1"), border: `1px solid ${col.accent}` }}>
                    {card.tag}
                  </span>
                </motion.div>
              ))}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Floating card 1: Match Score (top-left) ──────────────── */}
      <motion.div
        key={`score-${cycleKey}`}
        initial={{ opacity: 0, x: -12, y: -8 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.45, delay: 0.6 }}
        className="absolute top-0 left-0 px-3 py-2.5 rounded-xl z-10"
        style={{
          background: "rgba(10,10,20,0.97)",
          border: "1px solid rgba(99,102,241,0.4)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(99,102,241,0.12)",
        }}
      >
        <div className="flex items-center gap-2.5">
          {/* Animated ring */}
          <div className="relative w-10 h-10 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="3" />
              <motion.circle
                key={`ring-${cycleKey}`}
                cx="18" cy="18" r="15"
                fill="none"
                stroke="url(#grad)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="94.2"
                initial={{ strokeDashoffset: 94.2 }}
                animate={{ strokeDashoffset: 94.2 * 0.13 }}
                transition={{ duration: 1.1, delay: 0.8, ease: "easeOut" }}
              />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold text-indigo-300">
                <Counter target={87} duration={1100} cycleKey={cycleKey} />%
              </span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-white">Match Score</p>
            <p className="text-[9px] text-white/35 mt-0.5">Vercel · SWE Role</p>
            <div className="flex items-center gap-1 mt-1">
              <motion.div
                key={`pulse-${cycleKey}`}
                className="w-1 h-1 rounded-full bg-green-400"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-[8px] text-green-400">Strong match</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Floating card 2: Autofill (bottom-left) ──────────────── */}
      <motion.div
        key={`autofill-${cycleKey}`}
        initial={{ opacity: 0, x: -12, y: 12 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.45, delay: 0.9 }}
        className="absolute bottom-2 left-0 px-3 py-2.5 rounded-xl z-10 w-[178px]"
        style={{
          background: "rgba(10,10,20,0.97)",
          border: "1px solid rgba(99,102,241,0.25)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-3.5 h-3.5 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[8px]">⚡</div>
          <span className="text-[10px] font-semibold text-white">AI Autofill</span>
          <div className="ml-auto flex gap-0.5">
            {[0,1,2].map(i => (
              <motion.div key={i} className="w-1 h-1 rounded-full bg-indigo-400"
                animate={{ opacity: [0.3,1,0.3] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
        {AUTOFILL_FIELDS.map((f) => (
          <motion.div
            key={`${f.label}-${cycleKey}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.0 + f.delay, duration: 0.3 }}
            className="flex items-center gap-1.5 py-0.5"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.0 + f.delay + 0.15, type: "spring", stiffness: 300 }}
              className="w-3 h-3 rounded bg-indigo-500 flex items-center justify-center flex-shrink-0"
            >
              <svg width="6" height="5" viewBox="0 0 6 5" fill="none">
                <path d="M1 2.5L2.5 4L5 1" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </motion.div>
            <span className="text-[9px] text-white/35 w-8 flex-shrink-0">{f.label}</span>
            <span className="text-[9px] text-indigo-300 font-medium truncate">{f.val}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Floating card 3: ATS Score (bottom-right) ────────────── */}
      <motion.div
        key={`ats-${cycleKey}`}
        initial={{ opacity: 0, x: 12, y: 12 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.45, delay: 1.1 }}
        className="absolute bottom-2 right-0 px-3 py-2.5 rounded-xl z-10"
        style={{
          background: "rgba(10,10,20,0.97)",
          border: "1px solid rgba(16,185,129,0.35)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 16px rgba(16,185,129,0.08)",
        }}
      >
        <p className="text-[9px] text-white/35 mb-0.5">ATS Score</p>
        <div className="flex items-baseline gap-1 mb-1.5">
          <span className="text-xl font-bold text-emerald-400">
            <Counter target={91} duration={1300} cycleKey={cycleKey} />
          </span>
          <span className="text-xs text-emerald-400/50">/ 100</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {["Keywords","Format","Length"].map((t, i) => (
            <motion.span
              key={`${t}-${cycleKey}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.3 + i * 0.12, type: "spring", stiffness: 260 }}
              className="text-[8px] px-1.5 py-0.5 rounded font-semibold"
              style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}
            >
              ✓ {t}
            </motion.span>
          ))}
        </div>
      </motion.div>

      {/* ── New application toast — pops in mid-cycle ────────────── */}
      <AnimatePresence>
        <motion.div
          key={`toast-${cycleKey}`}
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, -4], scale: [0.95, 1, 1, 0.95] }}
          transition={{ duration: 0.4, delay: 2.5, times: [0, 0.15, 0.75, 1], repeat: 0 }}
          className="absolute top-6 right-0 px-2.5 py-2 rounded-lg z-20 flex items-center gap-2"
          style={{
            background: "rgba(16,185,129,0.15)",
            border: "1px solid rgba(16,185,129,0.3)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <span className="text-emerald-400 text-xs">✓</span>
          <span className="text-[10px] text-emerald-300 font-medium whitespace-nowrap">Application tracked!</span>
        </motion.div>
      </AnimatePresence>

    </div>
  );
}
