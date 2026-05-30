"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, ExternalLink, Bookmark, BookmarkCheck, Loader2, Settings, Clock, Building2, Sparkles, SlidersHorizontal, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@applyflow/ui";
import { api } from "@/lib/api";

export interface Job {
  id: string; title: string; company: string; location: string;
  url: string; description: string; salary: string;
  posted_at: string; source: string; provider: string;
}

const SOURCE_COLORS: Record<string, string> = {
  linkedin: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  indeed: "bg-purple-500/15 text-purple-300 border-purple-500/20",
  glassdoor: "bg-green-500/15 text-green-300 border-green-500/20",
  naukri: "bg-orange-500/15 text-orange-300 border-orange-500/20",
  adzuna: "bg-teal-500/15 text-teal-300 border-teal-500/20",
  jsearch: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  default: "bg-white/5 text-on-surface-variant/50 border-white/10",
};

const PROVIDER_COLORS: Record<string, string> = {
  jsearch: "bg-blue-500/10 text-blue-300",
  adzuna: "bg-teal-500/10 text-teal-300",
  apify: "bg-amber-500/10 text-amber-300",
};

function JobCard({ job, onSave, isNew }: { job: Job; onSave: (job: Job) => Promise<void>; isNew?: boolean }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const srcCls = SOURCE_COLORS[job.source?.toLowerCase()] ?? SOURCE_COLORS.default;

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(job); setSaved(true); } finally { setSaving(false); }
  }

  return (
    <motion.div
      layout
      initial={isNew ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <GlassPanel variant="card" className="p-4 flex flex-col gap-3 hover:border-white/15 transition-all h-full">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-primary/60" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-body-md font-semibold text-on-surface truncate leading-tight">{job.title}</h3>
            <p className="text-label-sm text-on-surface-variant mt-0.5">{job.company}</p>
          </div>
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${srcCls}`}>
            {job.source}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-label-sm text-on-surface-variant/60">
          {job.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{job.location}</span>}
          {job.posted_at && <span className="flex items-center gap-1"><Clock className="h-3 w-3 shrink-0" />{new Date(job.posted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
          {job.salary && <span className="font-medium text-green-400/80">{job.salary}</span>}
        </div>

        {job.description && (
          <p className="text-label-sm text-on-surface-variant/50 leading-relaxed line-clamp-2 flex-1">{job.description}</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button onClick={handleSave} disabled={saving || saved}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-label-sm font-medium transition-all
              ${saved ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-white/[0.03] border-white/10 text-on-surface-variant hover:bg-white/[0.07]"}`}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" />
             : saved  ? <><BookmarkCheck className="h-3 w-3" /> Saved</>
             : <><Bookmark className="h-3 w-3" /> Save</>}
          </button>
          <a href={job.url} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-primary text-on-primary text-label-sm font-medium hover:bg-primary/90 transition-colors">
            Apply <ExternalLink className="h-3 w-3" />
          </a>
          <button onClick={async () => { await onSave(job); window.open(job.url, "_blank"); }}
            className="h-8 px-2.5 rounded-lg bg-primary/10 border border-primary/25 text-primary text-label-sm font-medium hover:bg-primary/20 transition-colors whitespace-nowrap text-xs">
            Save+Apply
          </button>
        </div>
      </GlassPanel>
    </motion.div>
  );
}

export function JobsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [datePosted, setDatePosted] = useState("week");
  const [jobType, setJobType] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [country, setCountry] = useState("in");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [newJobIds, setNewJobIds] = useState<Set<string>>(new Set());
  const [fastLoading, setFastLoading] = useState(false);
  const [apifyStatus, setApifyStatus] = useState<"idle" | "starting" | "running" | "done" | "error">("idle");
  const [apifyError, setApifyError] = useState("");
  const [apifyCount, setApifyCount] = useState(0);
  const [fastError, setFastError] = useState("");
  const [fastProviders, setFastProviders] = useState<string[]>([]);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]); // empty = all
  const [providerStats, setProviderStats] = useState<Record<string, { status: "ok" | "error"; count: number; error: string | null }>>({});
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);
  const [apifyDuplicatesRemoved, setApifyDuplicatesRemoved] = useState(0);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [searched, setSearched] = useState(false);
  type ApifyRun = { run_id: string; dataset_id: string; actor: string; label: string };
  const apifyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const apifyRunsRef = useRef<ApifyRun[]>([]);
  const apifyDoneRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    api.jobs.getConfigs()
      .then(r => {
        const enabled = r.configs.filter(c => c.configured && c.enabled).map(c => c.provider);
        setConfigured(enabled.length > 0);
        setAvailableProviders(enabled);
      })
      .catch(() => setConfigured(false));
    return () => { if (apifyPollRef.current) clearInterval(apifyPollRef.current); };
  }, []);

  function stopPolling() {
    if (apifyPollRef.current) { clearInterval(apifyPollRef.current); apifyPollRef.current = null; }
  }

  const pollApify = useCallback(async () => {
    const pending = apifyRunsRef.current.filter(r => !apifyDoneRef.current.has(r.run_id));
    if (pending.length === 0) { stopPolling(); setApifyStatus("done"); return; }
    const current = pending[0];
    if (!current) return;
    try {
      const { run_id, dataset_id, actor, label } = current;
      const result = await api.jobs.apifyPoll(run_id, dataset_id, actor, label);
      if (result.status === "SUCCEEDED") {
        apifyDoneRef.current.add(run_id);
        setApifyCount(c => c + (result.raw_count ?? result.jobs.length));
        setApifyDuplicatesRemoved(d => d + (result.duplicates_removed ?? 0));
        // Check if all runs are done
        const allDone = apifyRunsRef.current.every(r => apifyDoneRef.current.has(r.run_id));
        if (allDone) { stopPolling(); setApifyStatus("done"); }
        if (result.jobs.length > 0) {
          setJobs(prev => {
            const existingUrls = new Set(prev.map(j => j.url));
            const existingKeys = new Set(prev.map(j =>
              j.company.toLowerCase().replace(/\W/g, "") + j.title.toLowerCase().replace(/\W/g, "")
            ));
            const fresh = result.jobs.filter(j => {
              const key = j.company.toLowerCase().replace(/\W/g, "") + j.title.toLowerCase().replace(/\W/g, "");
              return !existingUrls.has(j.url) && !existingKeys.has(key);
            });
            if (fresh.length) {
              setNewJobIds(new Set(fresh.map((j, i) => j.id || j.url || `apify-${i}`)));
              setTimeout(() => setNewJobIds(new Set()), 2000);
            }
            return [...prev, ...fresh];
          });
        }
      } else if (result.status !== "RUNNING") {
        stopPolling();
        setApifyStatus("error");
        setApifyError("Apify run failed.");
      }
    } catch { stopPolling(); setApifyStatus("error"); }
  }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    stopPolling();
    apifyRunsRef.current = []; apifyDoneRef.current = new Set();
    setJobs([]); setFastError(""); setApifyError(""); setNewJobIds(new Set());
    setProviderStats({}); setDuplicatesRemoved(0); setApifyDuplicatesRemoved(0); setApifyCount(0);
    setApifyStatus("idle"); setFastLoading(true); setSearched(true);

    // Phase 1: fast providers
    try {
      const filters = {
        date_posted: datePosted, job_type: jobType, remote_only: remoteOnly, country,
        providers: selectedProviders.length > 0 ? selectedProviders : undefined,
      };
      const result = await api.jobs.searchFast(query.trim(), location.trim(), filters);
      setJobs(result.jobs);
      setFastProviders(result.providers);
      setProviderStats(result.provider_stats ?? {});
      setDuplicatesRemoved(result.duplicates_removed ?? 0);
      // Auto-expand filters if 0 results so user can adjust
      if (result.jobs.length === 0) setShowFilters(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Search failed";
      if (msg.includes("No fast providers")) setConfigured(false);
      else setFastError(msg);
    } finally {
      setFastLoading(false);
    }

    // Phase 2: Apify in background
    setApifyStatus("starting");
    try {
      const { runs } = await api.jobs.apifyStart(query.trim(), location.trim(), { remote_only: remoteOnly, country });
      const validRuns = runs.filter(r => r.run_id && r.dataset_id) as { run_id: string; dataset_id: string; actor: string; label: string }[];
      apifyRunsRef.current = validRuns;
      apifyDoneRef.current = new Set();
      if (validRuns.length > 0) {
        setApifyStatus("running");
        apifyPollRef.current = setInterval(() => void pollApify(), 5000);
        void pollApify();
      } else {
        setApifyStatus("idle");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!msg.includes("not configured") && !msg.includes("disabled")) {
        setApifyError(msg);
      }
      setApifyStatus(msg.includes("not configured") || msg.includes("disabled") ? "idle" : "error");
    }
  }, [query, location, pollApify]);

  async function handleSave(job: Job) {
    await api.applications.create({
      company: job.company, role: job.title,
      job_url: job.url, job_description: job.description, status: "saved",
    });
  }

  if (configured === false) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
          <Search className="h-7 w-7 text-primary/60" />
        </div>
        <h2 className="text-title-lg font-display font-bold text-on-surface">Set up Job Search</h2>
        <p className="text-body-md text-on-surface-variant max-w-sm mx-auto">
          Add a JSearch or Adzuna API key to start searching. Apify is optional for deeper results.
        </p>
        <button onClick={() => router.push("/settings")}
          className="flex items-center gap-2 mx-auto h-10 px-6 rounded-xl bg-primary text-on-primary font-medium text-label-md hover:bg-primary/90 transition-colors">
          <Settings className="h-4 w-4" /> Configure APIs
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 space-y-5 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-headline-md font-display font-bold text-on-surface">Query Jobs</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">Results from JSearch, Adzuna and Apify — merged and deduplicated.</p>
        </div>
        <button onClick={() => router.push("/settings")} className="flex items-center gap-1.5 text-label-sm text-on-surface-variant/40 hover:text-primary transition-colors">
          <Settings className="h-3.5 w-3.5" /> Providers
        </button>
      </div>

      {/* Search */}
      <GlassPanel variant="card" className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/40" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && void search()}
              placeholder="Job title, role, or keywords…"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-container border border-outline-variant/40 text-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/40 transition-all" />
          </div>
          <div className="sm:w-44 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/40" />
            <input value={location} onChange={e => setLocation(e.target.value)}
              onKeyDown={e => e.key === "Enter" && void search()}
              placeholder="Location"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-container border border-outline-variant/40 text-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/40 transition-all" />
          </div>
          <button onClick={() => void search()} disabled={fastLoading || !query.trim()}
            className="h-10 px-6 rounded-xl bg-primary text-on-primary font-medium text-label-md hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
            {fastLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
      </GlassPanel>

      {/* Filter bar */}
      <div className="space-y-2">
        {/* Toggle row */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-label-sm transition-all
              ${showFilters ? "bg-primary/10 border-primary/30 text-primary" : "bg-white/[0.03] border-white/8 text-on-surface-variant/60 hover:border-white/15"}`}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {/* Active filter summary */}
            {(datePosted !== "week" || jobType || remoteOnly || country !== "in") && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary ml-0.5" />
            )}
          </button>

          {/* Provider selector chips */}
          {availableProviders.filter(p => p !== "apify").map(p => {
            const active = selectedProviders.length === 0 || selectedProviders.includes(p);
            const LABELS: Record<string, string> = { jsearch: "JSearch", adzuna: "Adzuna" };
            return (
              <button key={p}
                onClick={() => setSelectedProviders(prev => {
                  // If currently "all", switching to just this one
                  if (prev.length === 0) return availableProviders.filter(ap => ap !== "apify" && ap !== p);
                  // Toggle this provider
                  const next = prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p];
                  // If all are selected, go back to "all" (empty = all)
                  const fastOnes = availableProviders.filter(ap => ap !== "apify");
                  return next.length === fastOnes.length ? [] : next;
                })}
                className={`h-7 px-3 rounded-full text-label-sm border transition-all
                  ${active
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-white/[0.02] border-white/8 text-on-surface-variant/30 line-through"}`}>
                {LABELS[p] ?? p}
              </button>
            );
          })}

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Quick chips — always visible */}
          {(["today","week","month"] as const).map(d => (
            <button key={d} onClick={() => { setDatePosted(d); void search(); }}
              className={`h-7 px-3 rounded-full text-label-sm border transition-all
                ${datePosted === d && searched ? "bg-primary/10 border-primary/30 text-primary" : "bg-white/[0.02] border-white/8 text-on-surface-variant/50 hover:border-white/15"}`}>
              {d === "today" ? "Today" : d === "week" ? "This week" : "This month"}
            </button>
          ))}
          {(["fulltime","contract","parttime"] as const).map(t => (
            <button key={t} onClick={() => { setJobType(jobType === t ? "" : t); }}
              className={`h-7 px-3 rounded-full text-label-sm border transition-all
                ${jobType === t ? "bg-primary/10 border-primary/30 text-primary" : "bg-white/[0.02] border-white/8 text-on-surface-variant/50 hover:border-white/15"}`}>
              {t === "fulltime" ? "Full-time" : t === "parttime" ? "Part-time" : "Contract"}
            </button>
          ))}
          <button onClick={() => setRemoteOnly(v => !v)}
            className={`h-7 px-3 rounded-full text-label-sm border transition-all
              ${remoteOnly ? "bg-primary/10 border-primary/30 text-primary" : "bg-white/[0.02] border-white/8 text-on-surface-variant/50 hover:border-white/15"}`}>
            🌐 Remote
          </button>
        </div>

        {/* Expanded filter panel */}
        {showFilters && (
          <GlassPanel variant="card" className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface-variant/60">Date posted</label>
                <select value={datePosted} onChange={e => setDatePosted(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-surface-container border border-outline-variant/40 text-body-sm text-on-surface focus:outline-none focus:border-primary/40 transition-all">
                  <option value="any">Any time</option>
                  <option value="today">Today</option>
                  <option value="3days">Last 3 days</option>
                  <option value="week">This week</option>
                  <option value="month">This month</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface-variant/60">Job type</label>
                <select value={jobType} onChange={e => setJobType(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-surface-container border border-outline-variant/40 text-body-sm text-on-surface focus:outline-none focus:border-primary/40 transition-all">
                  <option value="">Any type</option>
                  <option value="fulltime">Full-time</option>
                  <option value="parttime">Part-time</option>
                  <option value="contract">Contract</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface-variant/60">Country</label>
                <select value={country} onChange={e => setCountry(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-surface-container border border-outline-variant/40 text-body-sm text-on-surface focus:outline-none focus:border-primary/40 transition-all">
                  <option value="in">India</option>
                  <option value="us">USA</option>
                  <option value="gb">UK</option>
                  <option value="au">Australia</option>
                  <option value="ca">Canada</option>
                  <option value="sg">Singapore</option>
                  <option value="de">Germany</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface-variant/60">Work mode</label>
                <button onClick={() => setRemoteOnly(v => !v)}
                  className={`w-full h-[38px] px-2.5 rounded-lg border text-body-sm font-medium transition-all
                    ${remoteOnly ? "bg-primary/10 border-primary/40 text-primary" : "bg-surface-container border-outline-variant/40 text-on-surface-variant/60 hover:border-white/20"}`}>
                  {remoteOnly ? "🌐 Remote only" : "Any mode"}
                </button>
              </div>
            </div>
            {/* Filter support matrix */}
            <div className="grid grid-cols-3 gap-2 text-[10px] text-on-surface-variant/40 border border-white/5 rounded-lg p-3 bg-black/10">
              <div className="font-semibold text-on-surface-variant/50 col-span-1" />
              {["jsearch","adzuna","apify"].filter(p => availableProviders.includes(p)).map(p => (
                <div key={p} className="font-semibold text-center capitalize text-on-surface-variant/50">{p}</div>
              ))}
              {([
                ["Date posted",   "✅ native",    "✅ native",    "⚠️ query"],
                ["Job type",      "✅ native",    "✅ native",    "⚠️ query"],
                ["Remote only",   "✅ native",    "⚠️ location",  "⚠️ query"],
                ["Country",       "⚠️ query",     "✅ native",    "✅ native"],
              ] as [string, string, string, string][]).map(([label, js, az, ap]) => {
                const vals: Record<string, string> = { jsearch: js, adzuna: az, apify: ap };
                return [
                  <div key={`${label}-l`} className="text-on-surface-variant/50">{label}</div>,
                  ...["jsearch","adzuna","apify"]
                    .filter(p => availableProviders.includes(p))
                    .map(p => (
                      <div key={`${label}-${p}`} className={`text-center ${vals[p]?.startsWith("✅") ? "text-green-400/60" : "text-amber-400/60"}`}>
                        {vals[p]}
                      </div>
                    )),
                ];
              })}
            </div>

            {/* Current params summary */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <p className="text-label-sm text-on-surface-variant/40">
                <span className="text-on-surface-variant/70 font-mono">&quot;{query || "—"}&quot;</span>
                {location && <> · <span className="font-mono">{location}</span></>}
                {" · "}{datePosted} · {jobType || "any type"} · {country.toUpperCase()}
                {remoteOnly && " · remote"}
                {" · via "}
                <span className="text-on-surface-variant/60">
                  {selectedProviders.length > 0
                    ? selectedProviders.join(" + ")
                    : (availableProviders.filter(p => p !== "apify").join(" + ") || "all")}
                </span>
              </p>
              <button onClick={() => void search()} disabled={fastLoading || !query.trim()}
                className="h-8 px-4 rounded-lg bg-primary text-on-primary text-label-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors">
                Retry search
              </button>
            </div>
          </GlassPanel>
        )}
      </div>

      {/* Fast loading */}
      {fastLoading && (
        <div className="flex items-center justify-center py-12 gap-3 text-on-surface-variant/60">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-body-md">Searching {fastProviders.length > 0 ? fastProviders.join(" + ") : "providers"}…</span>
        </div>
      )}

      {/* Fast error */}
      {fastError && !fastLoading && (
        <GlassPanel variant="card" className="p-4 border-red-500/20 bg-red-500/5">
          <p className="text-label-sm text-red-400">{fastError}</p>
        </GlassPanel>
      )}

      {/* Stats bar */}
      {!fastLoading && searched && (jobs.length > 0 || Object.keys(providerStats).length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Per fast-provider chips */}
          {Object.entries(providerStats).map(([provider, stat]) => (
            <div key={provider}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-label-sm font-medium
                ${stat.status === "ok"
                  ? "bg-green-500/10 border-green-500/25 text-green-300"
                  : "bg-red-500/10 border-red-500/25 text-red-300"}`}>
              {stat.status === "ok" ? "✓" : "✗"}
              <span className="capitalize">{provider}</span>
              {stat.status === "ok"
                ? <span className="text-on-surface-variant/50">{stat.count} found</span>
                : <span className="text-red-400/70 text-[10px] ml-1 max-w-[160px] truncate" title={stat.error ?? ""}>{stat.error}</span>}
            </div>
          ))}

          {/* Apify status chip */}
          {apifyStatus === "starting" && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-amber-500/10 border-amber-500/25 text-amber-300 text-label-sm">
              <Loader2 className="h-3 w-3 animate-spin" /> Apify starting…
            </div>
          )}
          {apifyStatus === "running" && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-amber-500/10 border-amber-500/25 text-amber-300 text-label-sm">
              <Sparkles className="h-3 w-3 animate-pulse" /> Apify fetching…
            </div>
          )}
          {apifyStatus === "done" && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-green-500/10 border-green-500/25 text-green-300 text-label-sm">
              ✓ <span>Apify</span>
              <span className="text-on-surface-variant/50">{apifyCount} found</span>
              {apifyDuplicatesRemoved > 0 && <span className="text-on-surface-variant/40 text-[10px]">· {apifyDuplicatesRemoved} dupes</span>}
            </div>
          )}
          {apifyStatus === "error" && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-red-500/10 border-red-500/25 text-red-300 text-label-sm" title={apifyError}>
              ✗ Apify failed
            </div>
          )}

          {/* Dedup summary */}
          {(duplicatesRemoved + apifyDuplicatesRemoved) > 0 && (
            <div className="px-3 py-1.5 rounded-full border bg-white/[0.03] border-white/8 text-label-sm text-on-surface-variant/40">
              {duplicatesRemoved + apifyDuplicatesRemoved} duplicate{(duplicatesRemoved + apifyDuplicatesRemoved) !== 1 ? "s" : ""} removed
            </div>
          )}

          {/* Total */}
          <p className="ml-auto text-label-sm text-on-surface-variant/40">
            {jobs.length} unique result{jobs.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Job grid */}
      <AnimatePresence>
        {!fastLoading && jobs.length > 0 && (
          <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" layout>
            {jobs.map((job, idx) => (
              <JobCard
                key={job.id || job.url || `job-${idx}`}
                job={job}
                onSave={handleSave}
                isNew={newJobIds.has(job.id || job.url || `job-${idx}`)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>


      {/* Empty state */}
      {!fastLoading && searched && jobs.length === 0 && !fastError && (
        <div className="text-center py-10 space-y-3">
          <p className="text-body-md text-on-surface-variant/60">
            No jobs found for <strong className="text-on-surface">&quot;{query}&quot;</strong>
          </p>
          <p className="text-label-sm text-on-surface-variant/40">
            Filters expanded above — try broadening your search:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-label-sm">
            <span className="text-on-surface-variant/30">Current:</span>
            <span className="px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant/50">{datePosted}</span>
            <span className="px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant/50">{jobType || "any type"}</span>
            <span className="px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant/50">{country.toUpperCase()}</span>
            {remoteOnly && <span className="px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant/50">remote only</span>}
          </div>
          <p className="text-label-sm text-on-surface-variant/30">
            Try: broader date range · remove job type filter · different country
          </p>
        </div>
      )}
    </div>
  );
}
