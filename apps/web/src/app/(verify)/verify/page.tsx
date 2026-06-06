"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Zap } from "lucide-react";
import { GradientText } from "@applyflow/ui";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

function VerifyContent() {
  const router      = useRouter();
  const params      = useSearchParams();
  const token       = params.get("token") ?? "";
  const setAuth     = useAuthStore((s) => s.setAuth);
  const user        = useAuthStore((s) => s.user);
  const storeToken  = useAuthStore((s) => s.token);

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setMessage("No verification token found."); return; }

    api.auth.verifyEmail(token)
      .then(() => {
        // Update local user state so AuthGuard lets them through
        if (user && storeToken) {
          setAuth({ ...user, email_verified: true }, storeToken);
        }
        setStatus("success");
        setTimeout(() => router.replace("/dashboard"), 2500);
      })
      .catch((err: unknown) => {
        setStatus("error");
        setMessage(
          err instanceof Error ? err.message : "Verification failed. The link may have expired."
        );
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-8 space-y-5 text-center">

          {status === "loading" && (
            <>
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              <p className="text-white/60 text-sm">Verifying your email…</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h1 className="text-xl font-bold text-white">Email verified!</h1>
                <p className="text-sm text-white/50">Redirecting you to your dashboard…</p>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-400" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h1 className="text-xl font-bold text-white">Verification failed</h1>
                <p className="text-sm text-white/50">{message}</p>
              </div>
              <button
                onClick={() => router.push("/verify-email")}
                className="w-full h-10 rounded-xl bg-primary/90 hover:bg-primary text-white text-sm font-semibold transition-all"
              >
                Request a new link
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>}>
      <VerifyContent />
    </Suspense>
  );
}
