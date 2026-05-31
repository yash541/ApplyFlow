"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer
      className="border-t py-12"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Logo & tagline */}
        <div className="flex flex-col items-center md:items-start gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs shadow-[0_0_12px_rgba(99,102,241,0.4)]">
              ⚡
            </div>
            <span className="font-bold text-white">
              Apply<span className="text-indigo-400">Flow</span>
            </span>
          </div>
          <p className="text-xs text-white/30 max-w-xs text-center md:text-left">
            AI-powered job application automation. Apply to jobs in 30 seconds.
          </p>
          <p className="text-xs text-white/20 mt-1">
            Powered by ApplyFlow AI
          </p>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6">
          <Link
            href="/login"
            className="text-sm text-white/40 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/40 hover:text-white transition-colors"
          >
            GitHub
          </a>
          <a
            href="mailto:avulayashwanth64@gmail.com"
            className="text-sm text-white/40 hover:text-white transition-colors"
          >
            Contact
          </a>
        </div>

        {/* Copyright */}
        <p className="text-xs text-white/20">
          © {new Date().getFullYear()} ApplyFlow AI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
