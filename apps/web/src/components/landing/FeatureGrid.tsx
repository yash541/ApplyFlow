"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const ALL_FEATURES = [
  {
    icon: "⚡",
    title: "Instant Autofill",
    desc: "AI fills every application field from your profile in seconds. Stream mode shows you answers as they generate.",
  },
  {
    icon: "🎯",
    title: "AI Match Scoring",
    desc: "Live score on every job page. Four-dimensional analysis across skills, experience, title, and education.",
  },
  {
    icon: "📄",
    title: "Resume Tailoring",
    desc: "One click rewrites resume bullets to mirror job description keywords. ATS-optimized without fabrication.",
  },
  {
    icon: "🗂️",
    title: "General Resumes",
    desc: "Tailor a resume for any role type — not just a specific job. Saved in your library under General Resumes, ready to download anytime.",
  },
  {
    icon: "⬇️",
    title: "PDF Download",
    desc: "Download any tailored resume as a polished PDF directly from the editor. One free download included — unlimited on Pro.",
  },
  {
    icon: "📊",
    title: "Applications Kanban",
    desc: "Drag-and-drop board tracking every application from Saved to Offer. Auto-advances on submission detection.",
  },
  {
    icon: "🔍",
    title: "Multi-Provider Search",
    desc: "Search JSearch, Adzuna, and Apify simultaneously. Results stream in as each source responds.",
  },
  {
    icon: "🔔",
    title: "Real-Time Notifications",
    desc: "Get alerted when applications advance, interviews are scheduled, or follow-ups are due.",
  },
  {
    icon: "🔄",
    title: "Cross-Portal Continuity",
    desc: "Seamlessly switch between Greenhouse, Workday, Lever, and 30+ other portals with consistent behavior.",
  },
  {
    icon: "🧠",
    title: "Profile That Learns",
    desc: "Your AI profile improves with every application. Answers get sharper as the model learns your voice.",
  },
  {
    icon: "✍️",
    title: "AI Field Regeneration",
    desc: "Unhappy with an answer? One click regenerates it with a different approach — you're always in control.",
  },
  {
    icon: "🚀",
    title: "Submission Detection",
    desc: "Extension detects when you submit a form and automatically moves the application to Applied status.",
  },
  {
    icon: "🔐",
    title: "Single Sign-On",
    desc: "Sign in with Google or GitHub. Session syncs between the web app and extension instantly.",
  },
  {
    icon: "⏸️",
    title: "Extension Toggle",
    desc: "Pause or resume the extension per-tab. Full control over when ApplyFlow is active.",
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
              transition={{ duration: 0.4, delay: 0.1 + i * 0.05 }}
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
