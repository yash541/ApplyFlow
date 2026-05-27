"use client";

import Link from "next/link";
import { ArrowUpRight, Building2 } from "lucide-react";
import { GlassPanel, Badge } from "@applyflow/ui";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const STATUS_VARIANT: Record<string, "primary" | "secondary" | "success" | "warning" | "error" | "neutral"> = {
  saved: "neutral",
  applied: "primary",
  screening: "secondary",
  interview: "warning",
  technical: "warning",
  offer: "success",
  rejected: "error",
  withdrawn: "neutral",
};

export function RecentApplications() {
  const { data, isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: () => api.applications.list(),
  });

  const recent = (data?.applications ?? []).slice(0, 4);

  return (
    <GlassPanel variant="card" className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-title-md font-display font-semibold text-on-surface">Recent Applications</h2>
        <Link href="/applications" className="text-label-md text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
          View all <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-body-md text-on-surface-variant/60">No applications yet</p>
          <Link href="/applications" className="text-label-sm text-primary hover:underline mt-1 inline-block">
            Start tracking →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {recent.map((app) => (
            <div key={app.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
              <div className="h-9 w-9 rounded-lg bg-surface-container-high border border-white/5 flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4 text-on-surface-variant/60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body-md font-medium text-on-surface truncate">{app.role}</p>
                <p className="text-label-sm text-on-surface-variant">{app.company}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge variant={STATUS_VARIANT[app.status] ?? "neutral"} size="sm">
                  {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                </Badge>
                <span className="text-label-sm text-on-surface-variant/50">
                  {new Date(app.applied_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}
