"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ExtensionPanelMockup } from "./ExtensionPanelMockup";
import { ScoreRingMockup } from "./ScoreRingMockup";
import { ResumeMockup } from "./ResumeMockup";
import { KanbanMockup } from "./KanbanMockup";
import { JobSearchMockup } from "./JobSearchMockup";

interface FeatureRowProps {
  reverse?: boolean;
  text: React.ReactNode;
  visual: React.ReactNode;
}

function FeatureRow({ reverse, text, visual }: FeatureRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div
      ref={ref}
      className={`flex flex-col lg:flex-row items-center gap-12 lg:gap-20 ${
        reverse ? "lg:flex-row-reverse" : ""
      }`}
    >
      <motion.div
        initial={{ opacity: 0, x: reverse ? 40 : -40 }}
        animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: reverse ? 40 : -40 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex-1"
      >
        {text}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: reverse ? -40 : 40 }}
        animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: reverse ? -40 : 40 }}
        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        className="flex-1 w-full"
      >
        {visual}
      </motion.div>
    </div>
  );
}

function FeatureLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4">
      <span className="w-4 h-px bg-indigo-500" />
      {label}
    </span>
  );
}

export function FeaturesSection() {
  return (
    <section id="features" className="py-32 relative">
      <div className="max-w-7xl mx-auto px-6 space-y-36">

        {/* Feature A: Smart Autofill */}
        <FeatureRow
          text={
            <div>
              <FeatureLabel label="Smart Autofill" />
              <h2 className="text-4xl font-bold text-white mb-5 leading-tight">
                AI reads every field and{" "}
                <span style={{
                  background: "linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  answers instantly
                </span>
              </h2>
              <p className="text-white/50 text-lg leading-relaxed mb-6">
                ApplyFlow's extension scans every application form field, uses ApplyFlow AI to generate the perfect answer from your profile, and streams
                results in real time — just like ChatGPT, but for job applications.
              </p>
              <ul className="space-y-2.5">
                {[
                  "Streams answers token by token in real time",
                  "You review & edit before anything is submitted",
                  "Tracks which fields were AI-filled vs. manual",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/60 text-sm">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          }
          visual={<ExtensionPanelMockup />}
        />

        {/* Feature B: Match Score */}
        <FeatureRow
          reverse
          text={
            <div>
              <FeatureLabel label="AI Match Score" />
              <h2 className="text-4xl font-bold text-white mb-5 leading-tight">
                Know your fit{" "}
                <span style={{
                  background: "linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  before you apply
                </span>
              </h2>
              <p className="text-white/50 text-lg leading-relaxed mb-6">
                Every job page shows a live match score calculated across skills,
                experience, title fit, and education — so you spend time on roles
                you'll actually land. The number counts up in real time as ApplyFlow AI
                analyzes the job description.
              </p>
              <ul className="space-y-2.5">
                {[
                  "4-dimensional scoring: skills, XP, title, education",
                  "Real-time calculation on every page load",
                  "Color-coded tiers: Excellent / Good / Fair / Low",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/60 text-sm">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          }
          visual={
            <div className="flex justify-center lg:justify-start">
              <ScoreRingMockup />
            </div>
          }
        />

        {/* Feature C: Resume Tailoring */}
        <FeatureRow
          text={
            <div>
              <FeatureLabel label="Resume Tailoring" />
              <h2 className="text-4xl font-bold text-white mb-5 leading-tight">
                Tailor your resume to{" "}
                <span style={{
                  background: "linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  every job description
                </span>
              </h2>
              <p className="text-white/50 text-lg leading-relaxed mb-6">
                One click rewrites your resume bullets to mirror keywords and
                priorities from the job description — ATS-optimized, never
                fabricated. ApplyFlow AI surfaces your real experience in the language
                the ATS and hiring manager expect.
              </p>
              <ul className="space-y-2.5">
                {[
                  "Mirrors JD keywords without hallucinating new experience",
                  "Quantifies impact from your existing bullet points",
                  "Download as PDF or copy to clipboard",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/60 text-sm">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          }
          visual={<ResumeMockup />}
        />

        {/* Feature D: Kanban */}
        <FeatureRow
          reverse
          text={
            <div>
              <FeatureLabel label="Applications Kanban" />
              <h2 className="text-4xl font-bold text-white mb-5 leading-tight">
                Never lose track of{" "}
                <span style={{
                  background: "linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  an application
                </span>
              </h2>
              <p className="text-white/50 text-lg leading-relaxed mb-6">
                Track every application through Saved → Applied → Interview →
                Offer. The extension auto-advances cards when it detects you
                submitted a form — no manual bookkeeping required.
              </p>
              <ul className="space-y-2.5">
                {[
                  "Auto-advances on form submission detection",
                  "Drag-and-drop between stages",
                  "Notes, reminders, and follow-up tracking",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/60 text-sm">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          }
          visual={
            <div className="flex justify-center lg:justify-start">
              <KanbanMockup />
            </div>
          }
        />

        {/* Feature E: Job Search */}
        <FeatureRow
          text={
            <div>
              <FeatureLabel label="Multi-Provider Job Search" />
              <h2 className="text-4xl font-bold text-white mb-5 leading-tight">
                Search every job board{" "}
                <span style={{
                  background: "linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  simultaneously
                </span>
              </h2>
              <p className="text-white/50 text-lg leading-relaxed mb-6">
                Search across JSearch, Adzuna, and Apify simultaneously. Results
                stream in as they arrive — no waiting for all sources to complete.
                Every result shows your match score so you can triage instantly.
              </p>
              <ul className="space-y-2.5">
                {[
                  "Three aggregated sources in one search",
                  "Results stream in real time as they arrive",
                  "Match score on every result card",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/60 text-sm">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          }
          visual={<JobSearchMockup />}
        />
      </div>
    </section>
  );
}
