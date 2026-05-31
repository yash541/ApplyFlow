"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const STEPS = [
  {
    num: "01",
    title: "Build your profile once",
    description:
      "Fill in your experience, skills, education, and preferences. The more you add, the better the AI fills every form. Your profile learns from each application.",
    icon: "👤",
    color: "from-indigo-500/20 to-violet-500/20",
    border: "border-indigo-500/20",
  },
  {
    num: "02",
    title: "Browse jobs, see your score",
    description:
      "Install the extension and browse any job page. ApplyFlow instantly shows your AI match score calculated across skills, experience, title fit, and education.",
    icon: "🎯",
    color: "from-violet-500/20 to-purple-500/20",
    border: "border-violet-500/20",
  },
  {
    num: "03",
    title: "Click, review, and fill",
    description:
      'Click "Answer Questions" on any application form. ApplyFlow AI streams answers in real time. You review each field, edit if needed, then click "Fill All" to submit.',
    icon: "⚡",
    color: "from-purple-500/20 to-pink-500/20",
    border: "border-purple-500/20",
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="how-it-works" className="py-32 relative">
      {/* Background accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(99,102,241,0.05),transparent)]" />

      <div className="relative max-w-7xl mx-auto px-6" ref={ref}>
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
            className="text-4xl lg:text-5xl font-bold text-white"
          >
            Three steps to your next job
          </motion.h2>
        </div>

        {/* Steps */}
        <div className="grid lg:grid-cols-3 gap-8 relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-12 left-[33%] right-[33%] h-px bg-gradient-to-r from-indigo-500/40 via-violet-500/40 to-purple-500/40" />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.12 }}
              className="relative"
            >
              <div
                className={`p-8 rounded-2xl bg-gradient-to-br ${step.color} border ${step.border} hover:scale-[1.02] transition-transform duration-200`}
                style={{
                  background: "rgba(15,15,26,0.8)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
                }}
              >
                {/* Step number */}
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{
                      background: "rgba(99,102,241,0.15)",
                      border: "1px solid rgba(99,102,241,0.25)",
                    }}
                  >
                    {step.icon}
                  </div>
                  <span
                    className="text-4xl font-black"
                    style={{
                      background: "linear-gradient(135deg, rgba(99,102,241,0.4) 0%, rgba(167,139,250,0.4) 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {step.num}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
