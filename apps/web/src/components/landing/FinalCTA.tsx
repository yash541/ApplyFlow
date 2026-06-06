"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";

export function FinalCTA() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(99,102,241,0.12),transparent)]" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, black, transparent)",
        }}
      />

      <div className="relative max-w-4xl mx-auto px-6 text-center" ref={ref}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6 }}
          className="p-12 lg:p-16 rounded-3xl relative overflow-hidden"
          style={{
            background: "rgba(15,15,26,0.8)",
            border: "1px solid rgba(99,102,241,0.2)",
            boxShadow: "0 0 80px rgba(99,102,241,0.1), 0 24px 80px rgba(0,0,0,0.5)",
          }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-8 bg-indigo-500/40 rounded-full blur-2xl" />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Live now · Free to start
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight"
          >
            Your next job starts{" "}
            <span style={{
              background: "linear-gradient(135deg, #818cf8 0%, #a78bfa 50%, #c084fc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              with one click.
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="text-white/40 text-lg mb-10 max-w-xl mx-auto"
          >
            Create your free account, install the extension, and go from browsing
            to applying in minutes — not hours. No credit card. No setup complexity.
            Just a smarter way to find your next role.
          </motion.p>

          {/* Value props row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-6 mb-10"
          >
            {[
              { icon: "⚡", text: "Autofill any ATS form" },
              { icon: "🎯", text: "AI match score on every job" },
              { icon: "📄", text: "Tailored resume in seconds" },
              { icon: "📊", text: "Track every application" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-sm text-white/50">
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/signup"
              className="px-10 py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 shadow-[0_0_40px_rgba(99,102,241,0.5)] hover:shadow-[0_0_60px_rgba(99,102,241,0.7)] transition-all duration-200"
            >
              Get Started Free →
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 rounded-xl font-semibold text-white/60 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-200"
            >
              Sign In
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-6 text-sm text-white/25"
          >
            Free plan included · Pro from $12/month · Cancel anytime
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
