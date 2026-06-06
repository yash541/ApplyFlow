"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";

const STEPS = [
  {
    num: "01",
    tag: "Web App",
    title: "Create your account & build your profile",
    description:
      "Sign up free at applyflow.in. Upload your existing resume — ApplyFlow AI extracts your experience, skills, and education automatically. Add any missing details to your master profile. This is the foundation everything else runs on.",
    details: ["Upload PDF / DOCX resume", "AI extracts your full profile", "Add skills, experience, preferences once"],
    icon: "👤",
    tagColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/25",
    accent: "from-indigo-500/20 to-indigo-500/5",
    border: "border-indigo-500/20",
  },
  {
    num: "02",
    tag: "Chrome Extension",
    title: "Install the extension — it auto-connects",
    description:
      "Install the ApplyFlow AI extension from the Chrome Web Store. It automatically connects to your applyflow.in account the moment you log in — no separate login, no setup. One install, everything works.",
    details: ["One-click install from Chrome Web Store", "Auto-connects to your web app account", "Works immediately on LinkedIn + 20+ ATS portals"],
    icon: "🔌",
    tagColor: "text-violet-400 bg-violet-500/10 border-violet-500/25",
    accent: "from-violet-500/20 to-violet-500/5",
    border: "border-violet-500/20",
  },
  {
    num: "03",
    tag: "LinkedIn",
    title: "Browse jobs — see your AI match score instantly",
    description:
      "Open any LinkedIn job listing. ApplyFlow overlays your AI match score (0–100) directly on the page — calculated across your skills, experience level, job title, and education. See matching keywords, missing skills, and whether the role is worth your time before you click Apply.",
    details: ["Live score on every LinkedIn job card", "Skill gap analysis + matching keywords", "Click 'Track this job' to save it instantly"],
    icon: "🎯",
    tagColor: "text-blue-400 bg-blue-500/10 border-blue-500/25",
    accent: "from-blue-500/20 to-blue-500/5",
    border: "border-blue-500/20",
  },
  {
    num: "04",
    tag: "ATS Portals",
    title: "Open the application form — autofill in one click",
    description:
      "Click Apply and you're taken to the ATS form (Greenhouse, Lever, Workday, and 20+ others). ApplyFlow detects every field on the page and fills them from your master profile — name, contact, work experience, education, work authorization, and more. AI handles any unusual fields your profile doesn't cover.",
    details: ["Detects all form fields automatically", "Fills from your profile in seconds", "AI handles unusual / custom questions"],
    icon: "⚡",
    tagColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
    accent: "from-emerald-500/20 to-emerald-500/5",
    border: "border-emerald-500/20",
  },
  {
    num: "05",
    tag: "Resume Lab",
    title: "Tailor your resume to the JD — download as PDF",
    description:
      "Go to Resume Lab in the dashboard. Paste the job description and click Tailor. ApplyFlow AI rewrites your resume bullets to mirror the JD's keywords and priorities — ATS-optimized, never fabricated. Edit any section inline, pick a PDF template, and download. Done.",
    details: ["AI tailors resume to each job description", "Edit bullets inline before downloading", "3 professional PDF templates to choose from"],
    icon: "📄",
    tagColor: "text-amber-400 bg-amber-500/10 border-amber-500/25",
    accent: "from-amber-500/20 to-amber-500/5",
    border: "border-amber-500/20",
  },
  {
    num: "06",
    tag: "Dashboard",
    title: "Track every application in one Kanban board",
    description:
      "Every job you track or apply to lands in your Applications dashboard. Drag cards between Saved → Applied → Interviewing → Offered. The extension detects form submissions and auto-advances cards. No manual bookkeeping — your pipeline stays current automatically.",
    details: ["Auto-tracks when you submit a form", "Drag-and-drop Kanban board", "Full history: company, role, notes, status"],
    icon: "📊",
    tagColor: "text-rose-400 bg-rose-500/10 border-rose-500/25",
    accent: "from-rose-500/20 to-rose-500/5",
    border: "border-rose-500/20",
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="how-it-works" className="py-32 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(99,102,241,0.05),transparent)]" />

      <div className="relative max-w-6xl mx-auto px-6" ref={ref}>
        {/* Heading */}
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium mb-6"
          >
            How It Works
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl lg:text-5xl font-bold text-white mb-5"
          >
            From profile to offer — the full flow
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-white/40 text-lg max-w-2xl mx-auto"
          >
            ApplyFlow is a web app and Chrome extension that work together as a single system.
            Here's exactly how the pieces connect.
          </motion.p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Vertical connector line */}
          <div className="hidden lg:block absolute left-[28px] top-10 bottom-10 w-px bg-gradient-to-b from-indigo-500/40 via-violet-500/20 to-transparent" />

          <div className="space-y-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, x: -24 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
                className="relative flex gap-6 lg:gap-10"
              >
                {/* Step number bubble */}
                <div className="flex-shrink-0 flex flex-col items-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl z-10"
                    style={{
                      background: "rgba(15,15,26,1)",
                      border: "1px solid rgba(99,102,241,0.3)",
                      boxShadow: "0 0 20px rgba(99,102,241,0.15)",
                    }}
                  >
                    {step.icon}
                  </div>
                </div>

                {/* Content */}
                <div
                  className={`flex-1 p-6 lg:p-8 rounded-2xl bg-gradient-to-br ${step.accent} border ${step.border} mb-2`}
                  style={{ background: "rgba(15,15,26,0.7)" }}
                >
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${step.tagColor}`}>
                      {step.tag}
                    </span>
                    <span className="text-[11px] font-bold text-white/20 uppercase tracking-widest">
                      Step {step.num}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-white/50 leading-relaxed mb-5 text-sm lg:text-base">{step.description}</p>

                  {/* Detail chips */}
                  <div className="flex flex-wrap gap-2">
                    {step.details.map((d) => (
                      <span
                        key={d}
                        className="flex items-center gap-1.5 text-xs text-white/50 px-3 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08]"
                      >
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA below */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="text-center mt-16"
        >
          <p className="text-white/40 mb-6 text-sm">Ready to see it in action?</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_40px_rgba(99,102,241,0.6)] transition-all duration-200"
          >
            Start Free — No Card Required →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
