"use client";

import Link from "next/link";
import { useState } from "react";
import { CreditCard, Plug, Lock, CheckCircle2 } from "lucide-react";
import { JobApiSettings } from "@/components/settings/JobApiSettings";
import { api } from "@/lib/api";

function ChangePasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (next.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (next !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await api.auth.changePassword(current, next);
      setSuccess(true);
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Lock className="h-5 w-5 text-primary" />
        <div>
          <p className="text-label-sm font-semibold text-on-surface">Change Password</p>
          <p className="text-label-xs text-on-surface-variant">Update your account password</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {[
          { label: "Current password", value: current, onChange: setCurrent },
          { label: "New password", value: next, onChange: setNext },
          { label: "Confirm new password", value: confirm, onChange: setConfirm },
        ].map(({ label, value, onChange }) => (
          <div key={label}>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">{label}</label>
            <input
              type="password"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50"
            />
          </div>
        ))}

        {error && <p className="text-xs text-red-400">{error}</p>}
        {success && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Password updated successfully.
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-9 px-5 rounded-lg bg-primary/90 hover:bg-primary text-white text-sm font-semibold transition-all disabled:opacity-50"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-headline-md font-display font-bold text-on-surface">Settings</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">Configure integrations and preferences.</p>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/settings/billing"
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-primary/30 hover:bg-primary/5 transition-all"
        >
          <CreditCard className="h-5 w-5 text-primary" />
          <div>
            <p className="text-label-sm font-semibold text-on-surface">Billing</p>
            <p className="text-label-xs text-on-surface-variant">Plan &amp; usage</p>
          </div>
        </Link>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <Plug className="h-5 w-5 text-on-surface-variant/50" />
          <div>
            <p className="text-label-sm font-semibold text-on-surface">Integrations</p>
            <p className="text-label-xs text-on-surface-variant">Job API keys</p>
          </div>
        </div>
      </div>

      <ChangePasswordSection />

      <JobApiSettings />
    </div>
  );
}
