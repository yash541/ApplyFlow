"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@applyflow/ui";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export function LoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.auth.login(email, password);
      setAuth(data.user, data.access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-label-sm text-on-surface-variant">Password</span>
          <Link href="/forgot-password" className="text-label-xs text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      <Button variant="primary" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign In"}
      </Button>
      <p className="text-label-sm text-on-surface-variant/60 text-center">
        No account?{" "}
        <Link href="/signup" className="text-primary hover:underline">
          Create one free
        </Link>
      </p>
    </form>
  );
}
