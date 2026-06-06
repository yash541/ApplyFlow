"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Zap, RefreshCw, CheckCircle2 } from "lucide-react";
import { GradientText } from "@applyflow/ui";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";

export default function VerifyEmailPage() {
  const router    = useRouter();
  const user      = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    try {
      await api.auth.resendVerification();
      setResent(true);
      // 60-second cooldown
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend. Try again.");
    } finally {
      setResending(false);
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

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-8 space-y-6 text-center">

          {/* Icon */}
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Check your inbox</h1>
            <p className="text-sm text-white/50 leading-relaxed">
              We sent a verification link to{" "}
              <span className="text-white/80 font-medium">{user?.email ?? "your email"}</span>.
              Click the link to activate your account.
            </p>
          </div>

          {/* Resent confirmation */}
          {resent && (
            <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              New link sent!
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Resend */}
          <button
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="w-full h-10 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
            {cooldown > 0
              ? `Resend in ${cooldown}s`
              : resending
              ? "Sending…"
              : "Resend verification email"}
          </button>

          <p className="text-xs text-white/25">
            Link expires in 24 hours. Check your spam folder if you don&apos;t see it.
          </p>

          <div className="h-px bg-white/[0.06]" />

          <button
            onClick={() => { clearAuth(); router.push("/login"); }}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Wrong email or want to use a different account?{" "}
            <span className="underline underline-offset-2">Back to login</span>
          </button>
        </div>
      </div>
    </div>
  );
}
