import { Metadata } from "next";
import { Zap } from "lucide-react";
import { GlassPanel, GradientText } from "@applyflow/ui";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background mesh-bg flex items-center justify-center p-4">
      <div className="absolute inset-0 ai-glow pointer-events-none" />

      <div className="w-full max-w-sm animate-scale-in">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-10 w-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <GradientText className="font-display font-bold text-2xl tracking-tight">
            ApplyFlow AI
          </GradientText>
        </div>

        <GlassPanel variant="card" className="p-6">
          <h1 className="text-title-lg font-display font-bold text-on-surface text-center mb-1">
            Welcome back
          </h1>
          <p className="text-body-sm text-on-surface-variant text-center mb-6">
            Sign in to your career operating system
          </p>
          <LoginForm />
        </GlassPanel>
      </div>
    </div>
  );
}
