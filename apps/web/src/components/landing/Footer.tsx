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
            AI-powered career operating system. Score, apply, tailor, and track — all in one place.
          </p>
          <p className="text-xs text-white/20 mt-1">
            Powered by advanced AI models
          </p>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6">
          <Link href="/#how-it-works" className="text-sm text-white/40 hover:text-white transition-colors">
            How It Works
          </Link>
          <Link href="/#pricing" className="text-sm text-white/40 hover:text-white transition-colors">
            Pricing
          </Link>
          <Link href="/privacy" className="text-sm text-white/40 hover:text-white transition-colors">
            Privacy
          </Link>
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
