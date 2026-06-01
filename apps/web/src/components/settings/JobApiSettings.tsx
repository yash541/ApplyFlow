"use client";

import { useState, useEffect } from "react";
import {
  ExternalLink, Check, AlertCircle, Loader2, Eye, EyeOff,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Plus, Trash2, FlaskConical, CheckCircle2, XCircle, Telescope, Sparkles,
} from "lucide-react";
import { GlassPanel } from "@applyflow/ui";
import { api } from "@/lib/api";

type Provider = "jsearch" | "adzuna" | "apify";

interface ApifyActorState {
  id?: string;
  label?: string;
  actor_id?: string;
  enabled?: boolean;
  input_mapping?: Record<string, string | null>;
  schema_fields?: string[];
  // test state
  testing?: boolean;
  testResult?: { ok: boolean; total: number; mapped: Record<string, unknown>; raw: Record<string, unknown>; warning?: string };
  testError?: string;
  showTest?: boolean;
  // schema discovery state (Phase 2)
  discovering?: boolean;
  schemaResult?: { actor_name: string; is_task: boolean; input_fields: { name: string; description: string }[]; suggested_mappings: Record<string, string | null> };
  schemaError?: string;
  showSchema?: boolean;
  pendingMapping?: Record<string, string | null>;
  // Phase 3: ApplyFlow AI output mapping
  output_mapping?: Record<string, string | null>;
  mappingWithAI?: boolean;
  mappingResult?: Record<string, string | null>;
  mappingConfidence?: Record<string, string>;
  mappingError?: string;
  showMapping?: boolean;
  pastedSample?: string;
}

interface ProviderState {
  key: string;
  app_id: string;
  enabled: boolean;
  configured: boolean;
  key_preview: string;
  showKey: boolean;
  expanded: boolean;
  actors: ApifyActorState[];  // Apify only
}

const PROVIDER_META: Record<Provider, { name: string; desc: string; keyLabel: string; docsUrl: string; free: string; speed: string; color: string }> = {
  jsearch: { name: "JSearch", desc: "LinkedIn, Indeed, Glassdoor in one call.", keyLabel: "RapidAPI Key", docsUrl: "https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch", free: "500 calls/mo free", speed: "< 1s", color: "text-blue-400" },
  adzuna: { name: "Adzuna", desc: "1,000/day free. Strong India coverage.", keyLabel: "App Key", docsUrl: "https://developer.adzuna.com/", free: "1,000/day free", speed: "< 1s", color: "text-teal-400" },
  apify: { name: "Apify", desc: "Deep scraping with multiple actors running in parallel.", keyLabel: "API Token", docsUrl: "https://apify.com/store?category=JOBS", free: "Pay-per-use", speed: "30–60s", color: "text-amber-400" },
};

const PROVIDERS: Provider[] = ["jsearch", "adzuna", "apify"];

function newActorId() { return Math.random().toString(36).slice(2, 10); }

export function JobApiSettings() {
  const [state, setState] = useState<Record<Provider, ProviderState>>(() => {
    const empty = (): ProviderState => ({
      key: "", app_id: "", enabled: false, configured: false,
      key_preview: "", showKey: false, expanded: false, actors: [],
    });
    return { jsearch: empty(), adzuna: empty(), apify: empty() };
  });
  const [saving, setSaving] = useState<Provider | null>(null);
  const [saved, setSaved] = useState<Provider | null>(null);
  const [error, setError] = useState<Record<Provider, string>>({ jsearch: "", adzuna: "", apify: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.jobs.getConfigs()
      .then(({ configs }) => {
        setState(prev => {
          const next = { ...prev };
          configs.forEach(c => {
            const p = c.provider as Provider;
            if (!PROVIDERS.includes(p)) return;
            next[p] = {
              ...next[p],
              enabled: c.enabled, configured: c.configured, key_preview: c.key_preview,
              app_id: (c as Record<string, unknown>).app_id as string || "",
              actors: ((c as Record<string, unknown>).actors as ApifyActorState[] | undefined) || [],
            };
          });
          return next;
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function patch(provider: Provider, field: Partial<ProviderState>) {
    setState(prev => ({ ...prev, [provider]: { ...prev[provider], ...field } }));
  }
  function patchActor(idx: number, field: Partial<ApifyActorState>) {
    setState(prev => {
      const actors = [...prev.apify.actors];
      actors[idx] = { ...actors[idx], ...field };
      return { ...prev, apify: { ...prev.apify, actors } };
    });
  }

  async function handleSave(provider: Provider) {
    const s = state[provider];
    // Key only required on first setup; on updates keep existing if left blank
    if (!s.key.trim() && !s.configured) { setError(prev => ({ ...prev, [provider]: "API key is required." })); return; }
    if (provider === "adzuna" && !s.app_id.trim()) { setError(prev => ({ ...prev, [provider]: "App ID is required." })); return; }
    if (provider === "apify" && s.actors.every(a => !a?.actor_id?.trim())) {
      setError(prev => ({ ...prev, [provider]: "Add at least one actor." })); return;
    }
    setSaving(provider); setError(prev => ({ ...prev, [provider]: "" }));
    try {
      // Empty key on update = keep existing; only send key if user typed one
      const body: Record<string, unknown> = { provider, key: s.key.trim() || "__KEEP__", app_id: s.app_id.trim() };
      if (provider === "apify") {
        body.actors = s.actors.filter(a => a?.actor_id?.trim()).map(a => ({
          id: a.id || newActorId(), label: a.label, actor_id: a?.actor_id?.trim(), enabled: a.enabled,
          input_mapping: a.input_mapping ?? {}, schema_fields: a.schema_fields ?? [],
          output_mapping: a.output_mapping ?? {},
        }));
      }
      await api.jobs.saveConfig(body as Parameters<typeof api.jobs.saveConfig>[0]);
      patch(provider, { configured: true, enabled: true, key_preview: s.key.slice(0, 6) + "…" + s.key.slice(-4), key: "", expanded: false });
      setSaved(provider);
      setTimeout(() => setSaved(null), 3000);
    } catch (e) {
      setError(prev => ({ ...prev, [provider]: e instanceof Error ? e.message : "Save failed." }));
    } finally {
      setSaving(null);
    }
  }

  async function handleDiscover(idx: number, actor: ApifyActorState) {
    patchActor(idx, { discovering: true, schemaError: undefined, showSchema: true });
    try {
      const result = await api.jobs.apifySchema(actor.actor_id ?? "");
      patchActor(idx, {
        discovering: false,
        schemaResult: result as ApifyActorState["schemaResult"],
        pendingMapping: { ...(result.suggested_mappings as Record<string, string | null>) },
      });
    } catch (e) {
      patchActor(idx, { discovering: false, schemaError: e instanceof Error ? e.message : "Discovery failed" });
    }
  }

  function handleSaveMapping(idx: number) {
    const actor = state.apify.actors[idx];
    if (!actor) return;
    const mapping = actor.pendingMapping ?? {};
    const fieldNames = (actor.schemaResult?.input_fields ?? []).map(f => f.name);
    patchActor(idx, { input_mapping: mapping, schema_fields: fieldNames, showSchema: false });
  }

  async function handleMapWithAI(idx: number, actor: ApifyActorState, sampleItem: Record<string, unknown>) {
    patchActor(idx, { mappingWithAI: true, mappingError: undefined, showMapping: true });
    try {
      const result = await api.jobs.apifyMapOutput(actor.actor_id ?? "", sampleItem);
      patchActor(idx, {
        mappingWithAI: false,
        mappingResult: result.mapping,
        mappingConfidence: result.confidence,
        output_mapping: result.mapping,  // auto-apply immediately, user can tweak
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Pydantic validation errors come as JSON array — unwrap to readable string
      const clean = msg.startsWith("[") ? "Invalid sample — paste a single job object (or an array, we'll take the first item)" : msg;
      patchActor(idx, { mappingWithAI: false, mappingError: clean });
    }
  }

  async function handleTestActor(idx: number, actor: ApifyActorState) {
    patchActor(idx, { testing: true, testError: undefined, testResult: undefined, showTest: true });
    try {
      const result = await api.jobs.apifyTest(actor.actor_id ?? "");
      patchActor(idx, { testing: false, testResult: result as unknown as ApifyActorState["testResult"] });
    } catch (e) {
      patchActor(idx, { testing: false, testError: e instanceof Error ? e.message : "Test failed" });
    }
  }

  if (loading) {
    return (
      <GlassPanel variant="card" className="p-6 flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </GlassPanel>
    );
  }

  return (
    <GlassPanel variant="card" className="p-6 space-y-5">
      <div>
        <h2 className="text-title-md font-display font-semibold text-on-surface">Job Search APIs</h2>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Fast providers (JSearch + Adzuna) return in &lt;2s. Apify runs multiple actors in parallel in the background.
        </p>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map(provider => {
          const meta = PROVIDER_META[provider];
          const s = state[provider];
          const err = error[provider];

          return (
            <div key={provider} className={`rounded-xl border transition-all ${s.configured ? "border-white/10 bg-white/[0.02]" : "border-white/5 bg-white/[0.01]"}`}>
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-label-md font-semibold ${meta.color}`}>{meta.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-on-surface-variant/50">{meta.free}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-on-surface-variant/50">⚡ {meta.speed}</span>
                    {s.configured && <span className="text-[10px] text-green-400 flex items-center gap-1"><Check className="h-2.5 w-2.5" /> {s.key_preview}</span>}
                  </div>

                  {/* Saved actors — visible in collapsed state */}
                  {provider === "apify" && s.configured && s.actors.length > 0 && !s.expanded && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {s.actors.map((a, i) => (
                        <button key={i}
                          onClick={() => patch(provider, { expanded: true })}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-all
                            ${a.enabled !== false
                              ? "bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20"
                              : "bg-white/[0.03] border-white/10 text-on-surface-variant/30 line-through"}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                          {a.label || a.actor_id?.split("~")[1] || "Actor"}
                        </button>
                      ))}
                      <button onClick={() => patch(provider, { expanded: true })}
                        className="px-2 py-0.5 rounded-full text-[10px] border border-dashed border-white/15 text-on-surface-variant/30 hover:border-white/25 transition-all">
                        + add more
                      </button>
                    </div>
                  )}

                  {!s.expanded && <p className="text-label-sm text-on-surface-variant/50 mt-0.5">{meta.desc}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.configured && (
                    <button onClick={() => patch(provider, { enabled: !s.enabled })} className="text-on-surface-variant/40 hover:text-on-surface-variant transition-colors">
                      {s.enabled ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                  )}
                  <button onClick={() => patch(provider, { expanded: !s.expanded })}
                    className="h-7 px-2 rounded-lg text-label-sm text-on-surface-variant/50 hover:bg-white/5 transition-colors flex items-center gap-1">
                    {s.configured ? "Update" : "Set up"}
                    {s.expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              {/* Expanded form */}
              {s.expanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
                  {/* Adzuna App ID */}
                  {provider === "adzuna" && (
                    <div className="space-y-1.5">
                      <label className="text-label-sm font-medium text-on-surface-variant">App ID</label>
                      <input type="text" value={s.app_id} onChange={e => patch(provider, { app_id: e.target.value })}
                        placeholder="e.g. a1b2c3d4"
                        className="w-full px-3 py-2 rounded-lg bg-surface-container border border-outline-variant/40 text-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/40 transition-all font-mono" />
                    </div>
                  )}

                  {/* API key */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-label-sm font-medium text-on-surface-variant">{meta.keyLabel}</label>
                      <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-primary/60 hover:text-primary flex items-center gap-1 transition-colors">
                        Get key <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                    <div className="relative">
                      <input type={s.showKey ? "text" : "password"} value={s.key}
                        onChange={e => patch(provider, { key: e.target.value })}
                        placeholder={s.configured ? "Leave blank to keep current token" : "Paste your key here…"}
                        className="w-full px-3 py-2 pr-9 rounded-lg bg-surface-container border border-outline-variant/40 text-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/40 transition-all font-mono" />
                      <button onClick={() => patch(provider, { showKey: !s.showKey })}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/30 hover:text-on-surface-variant transition-colors">
                        {s.showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Apify: same-key note */}
                  {provider === "apify" && (
                    <p className="text-[11px] text-on-surface-variant/40 px-1">
                      💡 One API token works for all actors in your account — no need for separate keys per actor.
                    </p>
                  )}

                  {/* Apify actors list */}
                  {provider === "apify" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-label-sm font-semibold text-on-surface-variant">Actors</label>
                        <button
                          onClick={() => patch("apify", { actors: [...s.actors, { id: newActorId(), label: "", actor_id: "", enabled: true }] })}
                          className="flex items-center gap-1 text-label-sm text-primary/70 hover:text-primary transition-colors">
                          <Plus className="h-3.5 w-3.5" /> Add actor
                        </button>
                      </div>

                      <div className="text-[11px] text-on-surface-variant/40 px-1">
                        Go to <a href="https://apify.com/store?category=JOBS" target="_blank" rel="noopener noreferrer" className="text-primary/60 hover:text-primary underline">apify.com/store → Jobs</a> → pick an actor → click <strong className="text-amber-300/70">"Save &amp; Try"</strong> → copy its slug.
                      </div>

                      {s.actors.length === 0 && (
                        <p className="text-label-sm text-on-surface-variant/40 italic px-1">No actors yet. Click "Add actor" above.</p>
                      )}

                      {s.actors.map((actor, idx) => (
                        <div key={actor.id} className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
                          <div className="flex items-center gap-2 p-3">
                            <button onClick={() => patchActor(idx, { enabled: !actor.enabled })}
                              className="shrink-0 text-on-surface-variant/30 hover:text-on-surface-variant transition-colors">
                              {actor.enabled ? <ToggleRight className="h-4 w-4 text-primary/70" /> : <ToggleLeft className="h-4 w-4" />}
                            </button>
                            <input value={actor.label} onChange={e => patchActor(idx, { label: e.target.value })}
                              placeholder="Label (e.g. Google Jobs)"
                              className="w-28 px-2 py-1 rounded-md bg-surface-container border border-outline-variant/30 text-label-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/40 transition-all" />
                            <input value={actor.actor_id ?? ""} onChange={e => patchActor(idx, { actor_id: e.target.value })}
                              placeholder="actor-slug (user~name)"
                              className="flex-1 px-2 py-1 rounded-md bg-surface-container border border-outline-variant/30 text-label-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/40 transition-all font-mono" />
                            {/* Discover schema button */}
                            <button
                              onClick={() => void handleDiscover(idx, actor)}
                              disabled={!(actor.actor_id ?? "").trim() || (!s.key.trim() && !s.configured) || actor.discovering}
                              title="Discover input schema"
                              className={`flex items-center gap-1 h-7 px-2.5 rounded-lg border text-label-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed
                                ${actor.input_mapping && Object.keys(actor.input_mapping).length > 0
                                  ? "border-green-500/30 bg-green-500/8 text-green-400 hover:bg-green-500/15"
                                  : "border-violet-500/25 bg-violet-500/8 text-violet-400 hover:bg-violet-500/15"}`}>
                              {actor.discovering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Telescope className="h-3 w-3" />}
                              {actor.input_mapping && Object.keys(actor.input_mapping).length > 0 ? "Mapped" : "Discover"}
                            </button>

                            {/* Test button */}
                            <button
                              onClick={() => void handleTestActor(idx, actor)}
                              disabled={!(actor.actor_id ?? "").trim() || (!s.key.trim() && !s.configured) || actor.testing}
                              title="Test this actor"
                              className="flex items-center gap-1 h-7 px-2.5 rounded-lg border border-primary/25 bg-primary/8 text-label-sm text-primary hover:bg-primary/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                              {actor.testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />}
                              Test
                            </button>
                            <button onClick={() => patch("apify", { actors: s.actors.filter((_, i) => i !== idx) })}
                              className="text-on-surface-variant/20 hover:text-red-400 transition-colors shrink-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Schema discovery + mapping panel */}
                          {actor.showSchema && (actor.schemaResult || actor.schemaError || actor.discovering) && (
                            <div className="border-t border-white/5 p-3 space-y-3">
                              {actor.discovering && (
                                <div className="flex items-center gap-2 text-label-sm text-violet-300">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching schema from Apify…
                                </div>
                              )}
                              {actor.schemaError && (
                                <div className="flex items-center gap-2 text-label-sm text-red-400">
                                  <XCircle className="h-3.5 w-3.5 shrink-0" /> {actor.schemaError}
                                </div>
                              )}
                              {actor.schemaResult && (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                                    <span className="text-label-sm text-green-300 font-medium">{actor.schemaResult.actor_name}</span>
                                    {actor.schemaResult.is_task && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Task</span>}
                                    <span className="text-label-sm text-on-surface-variant/40">{actor.schemaResult.input_fields.length} input fields</span>
                                  </div>

                                  {/* Mapping table */}
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] font-semibold text-on-surface-variant/50 uppercase tracking-wider">Input Field Mapping</p>
                                    <p className="text-[10px] text-on-surface-variant/35">Map each of our standard filters to the actor&apos;s exact input field name. Leave blank if not supported.</p>
                                    <div className="rounded-xl border border-white/8 overflow-hidden">
                                      {(["query","location","country","date_posted","max_results","remote_only"] as const).map(ourField => {
                                        const currentVal = actor.pendingMapping?.[ourField] ?? null;
                                        const fieldOptions = actor.schemaResult!.input_fields;
                                        const LABELS: Record<string, string> = {
                                          query: "Search query", location: "Location", country: "Country code",
                                          date_posted: "Date posted", max_results: "Max results", remote_only: "Remote only",
                                        };
                                        return (
                                          <div key={ourField} className="flex items-center gap-3 px-3 py-2 border-b border-white/5 last:border-0">
                                            <span className="w-28 text-[11px] text-on-surface-variant/60 shrink-0">{LABELS[ourField]}</span>
                                            <span className="text-on-surface-variant/30 text-[10px]">→</span>
                                            <select
                                              value={currentVal ?? ""}
                                              onChange={e => patchActor(idx, {
                                                pendingMapping: { ...(actor.pendingMapping ?? {}), [ourField]: e.target.value || null }
                                              })}
                                              className="flex-1 px-2 py-1 rounded-lg bg-surface-container border border-outline-variant/30 text-[11px] text-on-surface focus:outline-none focus:border-primary/40 font-mono"
                                            >
                                              <option value="">(not mapped)</option>
                                              {fieldOptions.map(f => (
                                                <option key={f.name} value={f.name}>
                                                  {f.name}{f.description ? ` — ${f.description.slice(0, 40)}` : ""}
                                                </option>
                                              ))}
                                            </select>
                                            {currentVal
                                              ? <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
                                              : <span className="h-3 w-3 shrink-0 text-on-surface-variant/20 text-[10px]">—</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleSaveMapping(idx)}
                                      className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-green-500/15 border border-green-500/25 text-green-400 text-label-sm font-medium hover:bg-green-500/25 transition-colors">
                                      <Check className="h-3 w-3" /> Save mapping
                                    </button>
                                    <button
                                      onClick={() => patchActor(idx, { showSchema: false })}
                                      className="h-7 px-3 rounded-lg text-label-sm text-on-surface-variant/40 hover:text-on-surface-variant/70 transition-colors">
                                      Close
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Test result */}
                          {actor.showTest && (actor.testResult || actor.testError) && (
                            <div className="border-t border-white/5 p-3 space-y-2">
                              {actor.testError ? (
                                <div className="flex items-start gap-2 text-label-sm text-red-400">
                                  <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {actor.testError}
                                </div>
                              ) : actor.testResult && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-label-sm">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                                      <span className="text-green-300">Actor works!</span>
                                      <span className="text-on-surface-variant/50">{actor.testResult.total} results returned</span>
                                      {actor.testResult.warning && <span className="text-amber-400/70">{actor.testResult.warning}</span>}
                                    </div>
                                    {/* Phase 3: Map with AI button */}
                                    {actor.testResult.total > 0 && (
                                      <button
                                        onClick={() => void handleMapWithAI(idx, actor, actor.testResult!.raw as Record<string, unknown>)}
                                        disabled={actor.mappingWithAI}
                                        className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300 text-label-sm hover:bg-violet-500/20 disabled:opacity-40 transition-all">
                                        {actor.mappingWithAI
                                          ? <><Loader2 className="h-3 w-3 animate-spin" /> Mapping…</>
                                          : <><Sparkles className="h-3 w-3" />{actor.output_mapping && Object.keys(actor.output_mapping).length > 0 ? "Re-map output" : "Map output with AI"}</>}
                                      </button>
                                    )}
                                  </div>

                                  {/* 0 results fallback — paste sample */}
                                  {actor.testResult.total === 0 && (
                                    <div className="space-y-2 mt-1">
                                      <p className="text-[11px] text-amber-400/70">
                                        0 results returned. Paste a sample JSON item (or array — we&apos;ll use the first item) from a successful Apify run:
                                      </p>
                                      <textarea
                                        value={actor.pastedSample ?? ""}
                                        onChange={e => patchActor(idx, { pastedSample: e.target.value })}
                                        placeholder={'{"title": "SWE", "companyName": "Google", "applyLink": "...", ...}'}
                                        rows={4}
                                        className="w-full px-3 py-2 rounded-lg bg-surface-container border border-outline-variant/40 text-[11px] text-on-surface font-mono placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/40 resize-none transition-all"
                                      />
                                      <button
                                        disabled={!actor.pastedSample?.trim() || actor.mappingWithAI}
                                        onClick={() => {
                                          try {
                                            let parsed = JSON.parse(actor.pastedSample!);
                                            // If user pasted an array, take the first item automatically
                                            if (Array.isArray(parsed)) {
                                              if (parsed.length === 0) {
                                                patchActor(idx, { mappingError: "Array is empty — paste at least one item" });
                                                return;
                                              }
                                              parsed = parsed[0];
                                            }
                                            if (typeof parsed !== "object" || parsed === null) {
                                              patchActor(idx, { mappingError: "Expected a JSON object or array of objects" });
                                              return;
                                            }
                                            void handleMapWithAI(idx, actor, parsed as Record<string, unknown>);
                                          } catch { patchActor(idx, { mappingError: "Invalid JSON — check the pasted sample" }); }
                                        }}
                                        className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300 text-label-sm hover:bg-violet-500/20 disabled:opacity-30 transition-all">
                                        {actor.mappingWithAI ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                        Map with AI
                                      </button>
                                    </div>
                                  )}
                                  {actor.testResult.total > 0 && (
                                    <div className="grid grid-cols-2 gap-2">
                                      {/* Mapped result */}
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold text-green-400/60 uppercase tracking-wider">Mapped (what we use)</p>
                                        <div className="rounded-lg bg-green-500/5 border border-green-500/15 p-2 text-[10px] font-mono space-y-0.5">
                                          {Object.entries(actor.testResult.mapped as Record<string, unknown>)
                                            .filter(([k]) => !["provider","id"].includes(k))
                                            .map(([k, v]) => (
                                              <div key={k} className={`flex gap-1.5 ${v ? "text-on-surface-variant/60" : "text-red-400/60"}`}>
                                                <span className="text-on-surface-variant/40 shrink-0">{k}:</span>
                                                <span className="truncate">{v ? String(v).slice(0, 50) : "⚠ empty"}</span>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                      {/* Raw output */}
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold text-amber-400/60 uppercase tracking-wider">Raw output (first item)</p>
                                        <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-2 text-[10px] font-mono space-y-0.5 max-h-40 overflow-y-auto">
                                          {Object.entries(actor.testResult.raw as Record<string, unknown>)
                                            .slice(0, 15)
                                            .map(([k, v]) => (
                                              <div key={k} className="flex gap-1.5 text-on-surface-variant/50">
                                                <span className="text-amber-400/40 shrink-0">{k}:</span>
                                                <span className="truncate">{String(v).slice(0, 50)}</span>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Phase 3: AI mapping result */}
                              {actor.mappingError && (
                                <p className="text-[11px] text-red-400 mt-2">{actor.mappingError}</p>
                              )}
                              {actor.showMapping && actor.mappingResult && (
                                <div className="mt-2 space-y-1.5">
                                  <p className="text-[10px] font-semibold text-violet-400/60 uppercase tracking-wider flex items-center gap-1">
                                    <Sparkles className="h-2.5 w-2.5" /> AI Output Mapping — Applied
                                  </p>
                                  <div className="rounded-xl border border-white/8 overflow-hidden">
                                    {Object.entries(actor.mappingResult).map(([std, src]) => (
                                      <div key={std} className="flex items-center gap-3 px-3 py-1.5 border-b border-white/5 last:border-0">
                                        <span className="w-20 text-[10px] text-on-surface-variant/50 shrink-0">{std}</span>
                                        <span className="text-on-surface-variant/20 text-[10px]">→</span>
                                        <span className={`text-[10px] font-mono flex-1 ${src ? "text-green-300" : "text-on-surface-variant/25 italic"}`}>
                                          {src ?? "not mapped"}
                                        </span>
                                        <span className={`text-[10px] ${src ? "text-green-400" : "text-on-surface-variant/20"}`}>
                                          {src ? "✓" : "—"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-[10px] text-on-surface-variant/30">Hit Save above to persist this mapping.</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Multi-config note for non-Apify providers */}
                  {provider === "jsearch" && (
                    <p className="text-[11px] text-on-surface-variant/35 px-1">
                      JSearch is a single API — one key covers all job boards (LinkedIn, Indeed, Glassdoor).
                    </p>
                  )}
                  {provider === "adzuna" && (
                    <p className="text-[11px] text-on-surface-variant/35 px-1">
                      Adzuna uses country-specific endpoints. To search multiple countries, save again with a different country selected in the Jobs page filter.
                    </p>
                  )}

                  {err && (
                    <div className="flex items-center gap-1.5 text-label-sm text-red-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {err}
                    </div>
                  )}

                  <button onClick={() => void handleSave(provider)}
                    disabled={saving === provider || (!s.key.trim() && !s.configured)}
                    className="flex items-center gap-2 h-9 px-5 rounded-xl bg-primary text-on-primary font-medium text-label-md hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    {saving === provider ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                     : saved === provider ? <><Check className="h-3.5 w-3.5" /> Saved!</>
                     : "Save"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-label-sm text-on-surface-variant/40">
        All enabled providers are called on every search. Results are merged and deduplicated automatically.
      </p>
    </GlassPanel>
  );
}
