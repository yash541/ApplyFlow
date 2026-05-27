"use client";

import Link from "next/link";
import { UserCircle, CheckCircle, Circle, ArrowRight } from "lucide-react";
import { GlassPanel } from "@applyflow/ui";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const CHECKS = [
  { label: "Phone & location", key: "contact" },
  { label: "Professional headline", key: "headline" },
  { label: "Work experience", key: "experience" },
  { label: "Education", key: "education" },
  { label: "Skills", key: "skills" },
  { label: "Work authorization", key: "auth" },
];

export function AutofillProfilePanel() {
  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.profile.get(),
  });

  const d = data?.data;

  const checks = d
    ? [
        !!(d.phone || d.location),
        !!d.headline,
        d.experience.length > 0,
        d.education.length > 0,
        d.skills.length > 0,
        !!d.work_authorization,
      ]
    : CHECKS.map(() => false);

  const filled = checks.filter(Boolean).length;
  const pct = Math.round((filled / CHECKS.length) * 100);

  return (
    <GlassPanel variant="card" className="p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
          <UserCircle className="h-3.5 w-3.5 text-primary" />
        </div>
        <h2 className="text-title-md font-display font-semibold text-on-surface">
          Autofill Profile
        </h2>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-label-sm text-on-surface-variant">Profile completion</span>
          <span className="text-label-sm font-semibold text-primary">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5">
          <div
            className="h-1.5 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-2 mb-4">
        {CHECKS.map((c, i) => (
          <div key={c.key} className="flex items-center gap-2.5">
            {checks[i] ? (
              <CheckCircle className="h-4 w-4 text-success shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-on-surface-variant/30 shrink-0" />
            )}
            <span className={`text-body-sm ${checks[i] ? "text-on-surface" : "text-on-surface-variant/50"}`}>
              {c.label}
            </span>
          </div>
        ))}
      </div>

      <Link href="/profile">
        <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/15 hover:bg-primary/10 transition-colors cursor-pointer">
          <span className="text-label-sm font-medium text-primary">
            {pct === 100 ? "Review your profile" : "Complete your profile"}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-primary" />
        </div>
      </Link>
    </GlassPanel>
  );
}
