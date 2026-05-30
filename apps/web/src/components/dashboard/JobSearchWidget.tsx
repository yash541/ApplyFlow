"use client";

import { useRouter } from "next/navigation";
import { Search, Settings, CheckCircle2, ArrowRight } from "lucide-react";
import { GlassPanel } from "@applyflow/ui";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const PROVIDER_COLORS: Record<string, { label: string; color: string; dot: string }> = {
  jsearch: { label: "JSearch", color: "text-blue-300", dot: "bg-blue-400" },
  adzuna:  { label: "Adzuna",  color: "text-teal-300", dot: "bg-teal-400" },
  apify:   { label: "Apify",   color: "text-amber-300", dot: "bg-amber-400" },
};

export function JobSearchWidget() {
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ["job-api-configs"],
    queryFn: () => api.jobs.getConfigs(),
    staleTime: 60_000,
  });

  const configs = data?.configs ?? [];
  const configured = configs.filter(c => c.configured && c.enabled);
  const hasAny = configured.length > 0;

  if (!hasAny) {
    return (
      <GlassPanel variant="card" className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary/60" />
          <h2 className="text-title-sm font-display font-semibold text-on-surface">Job Search</h2>
        </div>
        <p className="text-body-sm text-on-surface-variant/60 leading-relaxed">
          Connect JSearch, Adzuna, or Apify to search jobs from LinkedIn, Indeed, Naukri and more — all in one place.
        </p>
        <button
          onClick={() => router.push("/settings")}
          className="flex items-center gap-2 w-full h-9 px-4 rounded-xl border border-primary/25 bg-primary/8 text-primary text-label-md font-medium hover:bg-primary/15 transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          Set up job search APIs
          <ArrowRight className="h-3.5 w-3.5 ml-auto" />
        </button>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel variant="card" className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary/60" />
          <h2 className="text-title-sm font-display font-semibold text-on-surface">Job Search</h2>
        </div>
        <button onClick={() => router.push("/settings")}
          className="text-label-sm text-on-surface-variant/40 hover:text-primary transition-colors flex items-center gap-1">
          <Settings className="h-3 w-3" /> Manage
        </button>
      </div>

      {/* Provider status */}
      <div className="flex flex-wrap gap-2">
        {configured.map(c => {
          const meta = PROVIDER_COLORS[c.provider];
          const actorCount = (c as Record<string, unknown>).actors as { enabled?: boolean }[] | undefined;
          const enabledActors = actorCount?.filter(a => a.enabled !== false).length ?? 0;
          return (
            <div key={c.provider}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/8 text-label-sm">
              <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
              <span className={meta?.color ?? "text-on-surface-variant"}>{meta?.label ?? c.provider}</span>
              {c.provider === "apify" && enabledActors > 0 && (
                <span className="text-on-surface-variant/40">· {enabledActors} actor{enabledActors !== 1 ? "s" : ""}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick search */}
      <button
        onClick={() => router.push("/jobs")}
        className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 text-on-surface-variant/40 hover:border-primary/30 hover:text-on-surface-variant/60 transition-all text-body-sm"
      >
        <Search className="h-4 w-4 shrink-0" />
        Search for jobs…
        <ArrowRight className="h-3.5 w-3.5 ml-auto text-primary/50" />
      </button>
    </GlassPanel>
  );
}
