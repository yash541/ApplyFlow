"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, ArrowLeft } from "lucide-react";
import { GradientText } from "@applyflow/ui";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background mesh-bg flex items-center justify-center p-4">
      <div className="absolute inset-0 ai-glow pointer-events-none" />

      <div className="w-full max-w-sm animate-scale-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-10 w-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <GradientText className="font-display font-bold text-2xl tracking-tight">
            ApplyFlow AI
          </GradientText>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-8 space-y-6">
          {!sent ? (
            <>
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-white">Forgot your password?</h1>
                <p className="text-sm text-white/50">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                  />
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 rounded-xl bg-primary/90 hover:bg-primary text-white text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-3">
              <div className="text-4xl">📬</div>
              <h2 className="text-xl font-bold text-white">Check your inbox</h2>
              <p className="text-sm text-white/50 leading-relaxed">
                If <strong className="text-white/80">{email}</strong> is registered,
                you&apos;ll receive a reset link shortly. It expires in 1 hour.
              </p>
              <p className="text-xs text-white/30">Check your spam folder if you don&apos;t see it.</p>
            </div>
          )}

          <div className="h-px bg-white/[0.06]" />

          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
