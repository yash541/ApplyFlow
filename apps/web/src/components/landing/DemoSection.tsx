"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Stage durations (ms) ──────────────────────────────────────────────────────
const STAGE_DURATIONS = [4000, 5000, 4500, 4000];

const STAGES = [
  { id: "discover",  label: "Job Discovery",    icon: "🎯" },
  { id: "autofill",  label: "AI Autofill",       icon: "⚡" },
  { id: "tailor",    label: "Resume Tailoring",  icon: "📄" },
  { id: "track",     label: "Application Saved", icon: "📊" },
];

// ── Stage 1 — Job Discovery ───────────────────────────────────────────────────
function DiscoverStage() {
  const [scoreVisible, setScoreVisible] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setScoreVisible(true), 900);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (!scoreVisible) return;
    let current = 0;
    const target = 87;
    const interval = setInterval(() => {
      current += 3;
      if (current >= target) { setScore(target); clearInterval(interval); }
      else setScore(current);
    }, 20);
    return () => clearInterval(interval);
  }, [scoreVisible]);

  return (
    <div className="space-y-3">
      {/* Browser bar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex gap-1.5">
          {["#f87171","#fbbf24","#4ade80"].map(c => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />)}
        </div>
        <div className="flex-1 mx-2 px-3 py-1 rounded text-xs text-white/30" style={{ background: "rgba(255,255,255,0.05)" }}>
          linkedin.com/jobs/view/software-engineer-vercel
        </div>
      </div>

      {/* Job card */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-sm font-bold text-white">▲</div>
              <div>
                <p className="text-sm font-semibold text-white">Software Engineer</p>
                <p className="text-xs text-white/40">Vercel · Remote · Full-time</p>
              </div>
            </div>
            <p className="text-xs text-white/30 leading-relaxed mt-2 line-clamp-2">
              We're looking for a Software Engineer with experience in React, Node.js, and TypeScript to join our core platform team...
            </p>
          </div>
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-1.5">
          {["React", "TypeScript", "Node.js", "AWS", "CI/CD"].map(s => (
            <span key={s} className="px-2 py-0.5 rounded-full text-[10px] text-white/50" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>{s}</span>
          ))}
        </div>

        {/* Match score badge */}
        <AnimatePresence>
          {scoreVisible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs">⚡</div>
                <span className="text-xs font-semibold text-indigo-300">ApplyFlow Match Score</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 0.05 }}
                  />
                </div>
                <span className="text-sm font-bold text-indigo-300 w-10 text-right">{score}%</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-center text-xs text-white/25">AI analysing job fit in real time…</p>
    </div>
  );
}

// ── Stage 2 — AI Autofill ─────────────────────────────────────────────────────
const AUTOFILL_FIELDS = [
  { label: "First Name",    value: "Yashwanth",              delay: 300  },
  { label: "Last Name",     value: "Reddy Avula",            delay: 800  },
  { label: "Email",         value: "yash@applyflow.in",      delay: 1300 },
  { label: "Phone",         value: "+91 799 ••• ••••",       delay: 1800 },
  { label: "LinkedIn",      value: "linkedin.com/in/yash",   delay: 2300 },
  { label: "Experience",    value: "3 years",                delay: 2800 },
  { label: "Current Role",  value: "Full Stack Developer",   delay: 3300 },
  { label: "Notice Period", value: "Immediate",              delay: 3800 },
];

function TypewriterText({ text, speed = 35 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const iv = setInterval(() => {
      setDisplayed(text.slice(0, ++i));
      if (i >= text.length) clearInterval(iv);
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return <span>{displayed}<span className="animate-pulse text-indigo-400">|</span></span>;
}

function AutofillStage() {
  const [visible, setVisible] = useState<number[]>([]);
  const [typing, setTyping] = useState<number | null>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    AUTOFILL_FIELDS.forEach((f, i) => {
      timers.push(setTimeout(() => {
        setTyping(i);
        setTimeout(() => {
          setVisible(v => [...v, i]);
          setTyping(null);
        }, 450);
      }, f.delay));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="space-y-3">
      {/* Extension header */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs">⚡</div>
          <span className="text-xs font-semibold text-white">ApplyFlow — Greenhouse · Vercel</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-white/40">{visible.length}/{AUTOFILL_FIELDS.length} filled</span>
        </div>
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-2 gap-2">
        {AUTOFILL_FIELDS.map((field, i) => (
          <div
            key={field.label}
            className="px-3 py-2 rounded-lg transition-all"
            style={{
              background: visible.includes(i) ? "rgba(99,102,241,0.1)" : typing === i ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${visible.includes(i) ? "rgba(99,102,241,0.3)" : typing === i ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            <p className="text-[10px] text-white/35 mb-0.5">{field.label}</p>
            <p className="text-xs font-medium text-white truncate" style={{ fontFamily: "monospace", minHeight: "16px" }}>
              {visible.includes(i) ? (
                <span className="text-indigo-300">{field.value}</span>
              ) : typing === i ? (
                <TypewriterText text={field.value} speed={30} />
              ) : (
                <span className="text-white/20">——</span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Typing indicator */}
      {typing !== null && (
        <div className="flex items-center gap-2 px-2">
          <div className="flex gap-0.5">
            {[0,1,2].map(i => (
              <motion.div key={i} className="w-1 h-1 rounded-full bg-indigo-400"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
          <span className="text-xs text-indigo-400/60">AI filling {AUTOFILL_FIELDS[typing]?.label}…</span>
        </div>
      )}
      {visible.length === AUTOFILL_FIELDS.length && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs text-emerald-400">
          ✓ All 8 fields filled in 4 seconds
        </motion.p>
      )}
    </div>
  );
}

// ── Stage 3 — Resume Tailoring ────────────────────────────────────────────────
const BULLETS_BEFORE = [
  "Worked on React features",
  "Helped with backend APIs",
  "Fixed some performance issues",
];
const BULLETS_AFTER = [
  "Engineered React/TypeScript features serving **50K+ users**, reducing load time by **40%**",
  "Architected RESTful APIs with Node.js, cutting p95 latency from 800ms → **120ms**",
  "Optimised CI/CD pipelines on AWS, reducing deployment time by **3x**",
];

function TailorStage() {
  const [phase, setPhase] = useState<"before" | "rewriting" | "after">("before");
  const [atsScore, setAtsScore] = useState(42);
  const [revealedBullets, setRevealedBullets] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("rewriting"), 1200);
    const t2 = setTimeout(() => {
      setPhase("after");
      let s = 42;
      const iv = setInterval(() => {
        s += 2;
        setAtsScore(s);
        if (s >= 91) clearInterval(iv);
      }, 30);
    }, 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (phase !== "after") return;
    let i = 0;
    const iv = setInterval(() => {
      setRevealedBullets(++i);
      if (i >= BULLETS_AFTER.length) clearInterval(iv);
    }, 500);
    return () => clearInterval(iv);
  }, [phase]);

  function renderBullet(text: string) {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1
        ? <strong key={i} className="text-indigo-300 font-semibold">{part}</strong>
        : <span key={i}>{part}</span>
    );
  }

  return (
    <div className="space-y-3">
      {/* ATS score bar */}
      <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <span className="text-xs text-white/50">ATS Score</span>
        <div className="flex items-center gap-3 flex-1 mx-4">
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: atsScore >= 80 ? "linear-gradient(90deg,#6366f1,#8b5cf6)" : "linear-gradient(90deg,#f59e0b,#ef4444)" }}
              animate={{ width: `${atsScore}%` }}
              transition={{ duration: 0.05 }}
            />
          </div>
          <motion.span
            className="text-sm font-bold w-10 text-right"
            style={{ color: atsScore >= 80 ? "#818cf8" : "#fbbf24" }}
            animate={{ scale: atsScore >= 80 && phase === "after" ? [1, 1.2, 1] : 1 }}
            transition={{ duration: 0.3 }}
          >
            {atsScore}%
          </motion.span>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-lg font-semibold" style={{
          background: atsScore >= 80 ? "rgba(99,102,241,0.15)" : "rgba(245,158,11,0.15)",
          color: atsScore >= 80 ? "#818cf8" : "#fbbf24",
        }}>
          {atsScore >= 80 ? "Great" : "Weak"}
        </span>
      </div>

      {/* Resume bullets */}
      <div className="rounded-xl p-4 space-y-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-white/50">Experience · Full Stack Developer</p>
          {phase === "rewriting" && (
            <div className="flex items-center gap-1">
              {[0,1,2].map(i => (
                <motion.div key={i} className="w-1 h-1 rounded-full bg-indigo-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
              <span className="text-[10px] text-indigo-400/70 ml-1">AI rewriting…</span>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {phase === "before" && (
            <motion.div key="before" exit={{ opacity: 0 }} className="space-y-2">
              {BULLETS_BEFORE.map((b, i) => (
                <div key={i} className="flex gap-2 text-xs text-white/40">
                  <span className="mt-1 text-white/20">•</span>
                  <span>{b}</span>
                </div>
              ))}
            </motion.div>
          )}
          {phase === "rewriting" && (
            <motion.div key="rewriting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              {BULLETS_BEFORE.map((b, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="mt-1 text-white/20">•</span>
                  <span className="text-white/20 line-through">{b}</span>
                </div>
              ))}
            </motion.div>
          )}
          {phase === "after" && (
            <motion.div key="after" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              {BULLETS_AFTER.slice(0, revealedBullets).map((b, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2 text-xs text-white/80 leading-relaxed">
                  <span className="mt-1 text-indigo-400 flex-shrink-0">•</span>
                  <span>{renderBullet(b)}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Stage 4 — Application Tracked ────────────────────────────────────────────
const KANBAN_COLS = [
  { label: "Saved",        color: "rgba(255,255,255,0.06)", count: 3  },
  { label: "Applied",      color: "rgba(99,102,241,0.12)",  count: 5  },
  { label: "Interviewing", color: "rgba(245,158,11,0.12)",  count: 2  },
  { label: "Offered",      color: "rgba(16,185,129,0.12)",  count: 1  },
];

function TrackStage() {
  const [cardVisible, setCardVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setCardVisible(true), 700);
    const t2 = setTimeout(() => setToastVisible(true), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="space-y-3">
      {/* Toast */}
      <AnimatePresence>
        {toastVisible && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}
          >
            <span className="text-emerald-400 text-sm">✓</span>
            <span className="text-xs text-emerald-300 font-medium">Application tracked automatically — no manual entry needed</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kanban board */}
      <div className="grid grid-cols-4 gap-2">
        {KANBAN_COLS.map((col, ci) => (
          <div key={col.label} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">{col.label}</span>
              <span className="text-[10px] text-white/30">{col.count + (ci === 1 && cardVisible ? 1 : 0)}</span>
            </div>

            {/* New card in "Applied" column */}
            {ci === 1 && (
              <AnimatePresence>
                {cardVisible && (
                  <motion.div
                    initial={{ opacity: 0, y: -16, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="p-2 rounded-lg space-y-1"
                    style={{ background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.4)", boxShadow: "0 0 12px rgba(99,102,241,0.2)" }}
                  >
                    <p className="text-[10px] font-bold text-white leading-tight">Software Engineer</p>
                    <p className="text-[9px] text-indigo-300">Vercel · Remote</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(99,102,241,0.3)", color: "#a5b4fc" }}>Applied</span>
                      <span className="text-[8px] text-white/25">just now</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Placeholder cards */}
            {Array.from({ length: Math.min(col.count, ci === 1 ? 2 : 2) }).map((_, i) => (
              <div key={i} className="p-2 rounded-lg" style={{ background: col.color, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="h-2 w-16 rounded bg-white/10 mb-1" />
                <div className="h-1.5 w-10 rounded bg-white/6" />
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-white/25">All applications in one place · Never lose track</p>
    </div>
  );
}

// ── Main DemoSection ──────────────────────────────────────────────────────────
export function DemoSection() {
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [key, setKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const duration = STAGE_DURATIONS[stage] ?? 4000;

  const goToStage = (s: number) => {
    setStage(s);
    setProgress(0);
    setKey(k => k + 1);
  };

  useEffect(() => {
    setProgress(0);
    const tick = 50;
    progressRef.current = setInterval(() => {
      setProgress(p => Math.min(p + (tick / duration) * 100, 100));
    }, tick);
    intervalRef.current = setTimeout(() => {
      goToStage((stage + 1) % STAGES.length);
    }, duration);
    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [stage, duration]);

  const STAGE_COMPONENTS = [
    <DiscoverStage key={key} />,
    <AutofillStage key={key} />,
    <TailorStage key={key} />,
    <TrackStage key={key} />,
  ];

  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,rgba(99,102,241,0.06),transparent)]" />

      <div className="relative max-w-5xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            See it in action
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            From job listing to{" "}
            <span style={{ background: "linear-gradient(135deg,#818cf8 0%,#a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              application tracked
            </span>
          </h2>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            The complete flow — in under 60 seconds.
          </p>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
          {/* Stage selector */}
          <div className="space-y-2">
            {STAGES.map((s, i) => {
              const isActive = i === stage;
              const isDone = i < stage;
              return (
                <button
                  key={s.id}
                  onClick={() => goToStage(i)}
                  className="w-full text-left px-4 py-3 rounded-xl transition-all duration-200 group"
                  style={{
                    background: isActive ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isActive ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.07)"}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                      style={{ background: isActive ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.06)" }}>
                      {isDone ? "✓" : s.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isActive ? "text-white" : "text-white/50"}`}>{s.label}</p>
                    </div>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-indigo-400" : isDone ? "bg-emerald-400" : "bg-white/15"}`} />
                  </div>

                  {/* Progress bar */}
                  {isActive && (
                    <div className="mt-2.5 h-0.5 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Demo window */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "rgba(10,10,18,0.95)",
              border: "1px solid rgba(99,102,241,0.2)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.08)",
            }}
          >
            {/* Window chrome */}
            <div className="px-4 py-3 flex items-center gap-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
              <div className="flex gap-1.5">
                {["#f87171","#fbbf24","#4ade80"].map(c => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />)}
              </div>
              <div className="flex items-center gap-2 flex-1">
                <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs">⚡</div>
                <span className="text-xs text-white/40 font-medium">ApplyFlow</span>
                <span className="text-white/15 mx-1">·</span>
                <span className="text-xs text-white/25">{STAGES[stage]?.label}</span>
              </div>
            </div>

            {/* Stage content */}
            <div className="p-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${stage}-${key}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  {STAGE_COMPONENTS[stage]}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
