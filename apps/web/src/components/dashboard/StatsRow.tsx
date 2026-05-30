"use client";

import { TrendingUp, Briefcase, Calendar, Sparkles } from "lucide-react";
import { GlassPanel } from "@applyflow/ui";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function StatsRow() {
  const { data } = useQuery({
    queryKey: ["applications"],
    queryFn: () => api.applications.list(),
  });

  const apps = data?.applications ?? [];
  const total = apps.length;
  const interviews = apps.filter((a) => a.status === "interview" || a.status === "technical").length;
  const applied = apps.filter((a) => ["applied","screening","interview","technical","offer"].includes(a.status)).length;
  const tailored = apps.filter((a) => a.has_resume).length;
  const responseRate = total > 0 ? Math.round((applied / total) * 100) : 0;

  const STATS = [
    { label: "Total Applications", value: String(total), icon: Briefcase, color: "text-primary", bg: "bg-primary/10" },
    { label: "Interviews", value: String(interviews), icon: Calendar, color: "text-secondary", bg: "bg-secondary/10" },
    { label: "Resumes Tailored", value: String(tailored), icon: Sparkles, color: "text-violet-400", bg: "bg-violet-500/10" },
    { label: "Response Rate", value: `${responseRate}%`, icon: TrendingUp, color: "text-warning", bg: "bg-warning/10" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {STATS.map((stat) => (
        <GlassPanel key={stat.label} variant="card" className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className={`h-9 w-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </div>
          <p className="text-headline-sm font-display font-bold text-on-surface">{stat.value}</p>
          <p className="text-label-sm text-on-surface-variant mt-0.5">{stat.label}</p>
        </GlassPanel>
      ))}
    </div>
  );
}
