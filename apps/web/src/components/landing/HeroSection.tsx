"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ExtensionPanelMockup } from "./ExtensionPanelMockup";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_20%,rgba(99,102,241,0.12),transparent)]" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/5 rounded-full blur-[120px]" />

      <div className="relative max-w-7xl mx-auto px-6 py-24 flex flex-col lg:flex-row items-center gap-16">
        {/* Left: Text */}
        <div className="flex-1 text-center lg:text-left">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Your AI-powered career operating system
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-5xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight mb-6"
          >
            Land more jobs.{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #818cf8 0%, #a78bfa 50%, #c084fc 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Apply smarter.
            </span>
            <br />
            <span className="text-white/50">Do less busywork.</span>
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="text-lg text-white/50 max-w-xl mb-6 leading-relaxed"
          >
            ApplyFlow combines a <strong className="text-white/70">web dashboard</strong> and a{" "}
            <strong className="text-white/70">Chrome extension</strong> to score your job fit, autofill
            ATS forms, tailor your resume with AI, and track every application — all in one place.
          </motion.p>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="flex flex-wrap gap-2 mb-10 justify-center lg:justify-start"
          >
            {[
              "⚡ AI Autofill",
              "🎯 Match Scoring",
              "📄 Resume Tailoring",
              "📊 Application Tracking",
              "🔍 Job Search",
            ].map((pill) => (
              <span
                key={pill}
                className="px-3 py-1 rounded-full text-xs font-medium text-white/60 border border-white/10 bg-white/[0.04]"
              >
                {pill}
              </span>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="flex flex-col sm:flex-row items-center lg:items-start gap-4"
          >
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_40px_rgba(99,102,241,0.6)] transition-all duration-200 text-center"
            >
              Get Started Free →
            </Link>
            <a
              href="https://chromewebstore.google.com/detail/applyflow-ai/mcfbemijiellcnldfimonigejmjhejpf"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-white/80 border border-white/[0.12] hover:border-white/25 hover:text-white hover:bg-white/[0.04] transition-all duration-200 text-center flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
                <line x1="21.17" y1="8" x2="12" y2="8" />
                <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
                <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
              </svg>
              Add to Chrome — Free
            </a>
          </motion.div>

          {/* Trust line */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="mt-5 text-sm text-white/25 text-center lg:text-left"
          >
            Free to start · No credit card required · Works on 20+ ATS portals
          </motion.p>

        </div>

        {/* Right: Mockup */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="flex-shrink-0"
        >
          <ExtensionPanelMockup />
        </motion.div>
      </div>
    </section>
  );
}
