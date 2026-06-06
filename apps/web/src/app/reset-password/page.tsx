"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Zap, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { GradientText } from "@applyflow/ui";
import { api } from "@/lib/api";

function ResetPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.auth.resetPassword(token, password);
      setStatus("success");
      setTimeout(() => router.replace("/login"), 2500);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Reset failed. The link may have expired.");
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
          {status === "success" && (
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white">Password updated!</h2>
              <p className="text-sm text-white/50">Redirecting you to login…</p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-14 w-14 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                  <XCircle className="h-7 w-7 text-red-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white">Reset failed</h2>
              <p className="text-sm text-white/50">{error}</p>
              <Link
                href="/forgot-password"
                className="inline-block w-full h-10 rounded-xl bg-primary/90 hover:bg-primary text-white text-sm font-semibold transition-all text-center leading-10"
              >
                Request a new link
              </Link>
            </div>
          )}

          {status === "idle" && (
            <>
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-white">Set a new password</h1>
                <p className="text-sm text-white/50">Must be at least 8 characters.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">New password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Confirm password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                  />
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full h-10 rounded-xl bg-primary/90 hover:bg-primary text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Updating…" : "Update password"}
                </button>
              </form>
            </>
          )}

          {status === "idle" && (
            <>
              <div className="h-px bg-white/[0.06]" />
              <Link
                href="/login"
                className="block text-center text-sm text-white/30 hover:text-white/60 transition-colors"
              >
                Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
