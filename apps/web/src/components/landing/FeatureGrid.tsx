"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const ALL_FEATURES = [
  {
    icon: "⚡",
    title: "Smart Autofill",
    desc: "Extension scans every ATS form field and fills it from your master profile. Rule-based for standard fields, AI-powered for unusual ones.",
  },
  {
    icon: "🎯",
    title: "AI Match Scoring",
    desc: "Live 0-100 score on every LinkedIn job. Four-dimensional analysis: skills, experience, title fit, and education — with missing keywords highlighted.",
  },
  {
    icon: "📄",
    title: "Resume Tailoring",
    desc: "Paste any job description and get an ATS-optimized resume in seconds. Rewrites your bullets to mirror JD keywords — never fabricates experience.",
  },
  {
    icon: "📑",
    title: "3 PDF Templates",
    desc: "Download your tailored resume as a polished PDF. Choose from Classic, Modern, or Minimal templates — all ATS-friendly.",
  },
  {
    icon: "📚",
    title: "Resume Library",
    desc: "Save tailored resumes by role type — 'Fullstack Engineer', 'ML Engineer', etc. Reuse across multiple applications without re-tailoring every time.",
  },
  {
    icon: "📊",
    title: "Applications Kanban",
    desc: "Drag-and-drop board tracking every application across Saved → Applied → Interviewing → Offered → Rejected.",
  },
  {
    icon: "🔍",
    title: "Multi-Provider Job Search",
    desc: "Search JSearch, Adzuna, and Apify simultaneously from a single dashboard. Deduplicated results with your match score on every listing.",
  },
  {
    icon: "🧠",
    title: "Profile That Learns",
    desc: "Every autofill session saves your answers as learned fields. Future forms get smarter — unusual questions answered from your history.",
  },
  {
    icon: "🔗",
    title: "Cross-Portal Continuity",
    desc: "Session persists when you're redirected from LinkedIn to Greenhouse or Lever. Job context, data, and state carry over seamlessly.",
  },
  {
    icon: "🕵️",
    title: "Submission Detection",
    desc: "Extension detects when you submit an application form and automatically moves the card to 'Applied' in your Kanban board.",
  },
  {
    icon: "🔁",
    title: "Job Deduplication",
    desc: "Fingerprint hashing prevents duplicate applications from the same job re-posted across multiple portals or URLs.",
  },
  {
    icon: "🔔",
    title: "In-App Notifications",
    desc: "Real-time notification feed for application events, resume saves, and usage milestones — all inside the dashboard.",
  },
  {
    icon: "📈",
    title: "ATS Score on Resume",
    desc: "Every tailored resume gets an ATS compatibility score (0-100) shown alongside missing and matching keyword chips.",
  },
  {
    icon: "🔒",
    title: "Secure by Default",
    desc: "Passwords hashed with bcrypt. JWT authentication. All data sent over HTTPS. Your resume and profile never shared with employers.",
  },
];

export function FeatureGrid() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,rgba(99,102,241,0.06),transparent)]" />

      <div className="relative max-w-7xl mx-auto px-6" ref={ref}>
        {/* Heading */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium mb-6"
          >
            Everything included
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl lg:text-5xl font-bold text-white mb-4"
          >
            The full feature set
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-white/40 text-lg max-w-xl mx-auto"
          >
            Everything you need to go from job search to offer — no other tools required.
          </motion.p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ALL_FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.04 }}
              className="group p-5 rounded-xl hover:scale-[1.02] transition-all duration-200 cursor-default"
              style={{
                background: "rgba(15,15,26,0.8)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform"
                style={{
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
              >
                {feature.icon}
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">{feature.title}</h3>
              <p className="text-xs text-white/40 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
