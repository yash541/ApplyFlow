"use client";

import Link from "next/link";
import { FileText, UserCircle, Wand2, Search, Sparkles, Settings } from "lucide-react";
import { GlassPanel } from "@applyflow/ui";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function QuickActions() {
  const { data: configData } = useQuery({
    queryKey: ["job-api-configs"],
    queryFn: () => api.jobs.getConfigs(),
    staleTime: 60_000,
  });

  const hasJobSearch = configData?.configs.some(c => c.configured && c.enabled) ?? false;

  const ACTIONS = [
    {
      href: "/jobs",
      icon: Search,
      label: "Find Jobs",
      description: hasJobSearch ? "Search across all providers" : "Set up job search APIs",
      color: "text-primary",
      bg: "bg-primary/10 hover:bg-primary/15",
      border: "border-primary/20",
      badge: hasJobSearch ? null : "Setup",
    },
    {
      href: "/resume",
      icon: Wand2,
      label: "Tailor Resume",
      description: "AI-tailored to any job in seconds",
      color: "text-secondary",
      bg: "bg-secondary/10 hover:bg-secondary/15",
      border: "border-secondary/20",
      badge: null,
    },
    {
      href: "/resume",
      icon: FileText,
      label: "Upload Resume",
      description: "Parse and store your base resume",
      color: "text-violet-400",
      bg: "bg-violet-500/10 hover:bg-violet-500/15",
      border: "border-violet-500/20",
      badge: null,
    },
    {
      href: "/profile",
      icon: UserCircle,
      label: "Autofill Profile",
      description: "Save details for instant form fill",
      color: "text-success",
      bg: "bg-success/10 hover:bg-success/15",
      border: "border-success/20",
      badge: null,
    },
    {
      href: "/settings",
      icon: Settings,
      label: "Configure APIs",
      description: "Set up job search providers",
      color: "text-on-surface-variant/60",
      bg: "bg-white/[0.03] hover:bg-white/[0.06]",
      border: "border-white/8",
      badge: null,
    },
    {
      href: "/resume?action=tailor",
      icon: Sparkles,
      label: "Resume Lab",
      description: "Multi-template resume editor",
      color: "text-amber-400",
      bg: "bg-amber-500/10 hover:bg-amber-500/15",
      border: "border-amber-500/20",
      badge: null,
    },
  ];

  return (
    <GlassPanel variant="card" className="p-5">
      <h2 className="text-title-md font-display font-semibold text-on-surface mb-4">
        Quick Actions
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {ACTIONS.map((action) => (
          <Link key={action.href + action.label} href={action.href}>
            <div className={`relative flex items-start gap-3 p-4 rounded-xl border ${action.border} ${action.bg} transition-all duration-150 cursor-pointer h-full`}>
              {action.badge && (
                <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                  {action.badge}
                </span>
              )}
              <action.icon className={`h-5 w-5 ${action.color} shrink-0 mt-0.5`} />
              <div>
                <p className="text-label-md font-semibold text-on-surface">{action.label}</p>
                <p className="text-label-sm text-on-surface-variant/60 mt-0.5">{action.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </GlassPanel>
  );
}
