"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";

const STEPS = [
  {
    num: "1",
    title: "Create your account",
    desc: "Sign up free with Google or GitHub. Fill in your profile — name, skills, experience, education.",
    action: { label: "Create Account →", href: "/login" },
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    num: "2",
    title: "Install the extension",
    desc: "Download the extension zip. Open Chrome → Extensions → Enable Developer Mode → Load Unpacked → select the dist folder.",
    action: {
      label: "Request Extension →",
      href: "mailto:avulayashwanth64@gmail.com?subject=ApplyFlow%20Extension%20Request",
    },
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    num: "3",
    title: "Start applying",
    desc: "Browse any job page. See your match score. Click 'Answer Questions' and let ApplyFlow fill the application in 30 seconds.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
];

export function InstallSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="install" className="py-32 relative">
      {/* Accent glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(99,102,241,0.08),transparent)]" />

      <div className="relative max-w-5xl mx-auto px-6 text-center" ref={ref}>
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium mb-6"
        >
          Quick Setup
        </motion.div>

        {/* Heading */}
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl lg:text-6xl font-bold text-white mb-4"
        >
          Set up in{" "}
          <span style={{
            background: "linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            5 minutes
          </span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-white/40 text-lg mb-16 max-w-xl mx-auto"
        >
          No waitlist. No credit card. Just create an account, load the extension, and start applying.
        </motion.p>

        {/* Steps */}
        <div className="grid lg:grid-cols-3 gap-6 mb-12">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.12 }}
              className="relative text-left p-7 rounded-2xl"
              style={{
                background: "rgba(15,15,26,0.9)",
                border: "1px solid rgba(99,102,241,0.15)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
              }}
            >
              {/* Step number */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-indigo-400"
                  style={{
                    background: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.2)",
                  }}
                >
                  {step.icon}
                </div>
                <span className="text-xs font-bold text-indigo-400/60 uppercase tracking-wider">
                  Step {step.num}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed mb-5">{step.desc}</p>

              {step.action && (
                <Link
                  href={step.action.href}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {step.action.label}
                </Link>
              )}
            </motion.div>
          ))}
        </div>

        {/* Download CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="mailto:avulayashwanth64@gmail.com?subject=ApplyFlow%20Extension%20Request"
            className="px-8 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_40px_rgba(99,102,241,0.6)] transition-all duration-200 flex items-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Request Extension Access
          </a>
          <p className="text-sm text-white/30">
            Not on Chrome Web Store yet — email for direct access
          </p>
        </motion.div>
      </div>
    </section>
  );
}
