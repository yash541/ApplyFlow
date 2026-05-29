"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, ExternalLink, FileText, Sparkles, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { GlassPanel, Badge } from "@applyflow/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, streamTailor, type ApplicationData } from "@/lib/api";
import { useResumeLabStore, type TailoredContent } from "@/store/resumeLab";
import type { ApplicationStatus } from "@applyflow/shared";

function parseJsonResponse(raw: string): TailoredContent | null {
  try {
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(cleaned) as TailoredContent;
  } catch {
    return null;
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLUMNS: { status: ApplicationStatus; label: string; color: string }[] = [
  { status: "saved",      label: "Saved",     color: "border-t-outline" },
  { status: "applied",    label: "Applied",   color: "border-t-primary" },
  { status: "screening",  label: "Screening", color: "border-t-secondary" },
  { status: "interview",  label: "Interview", color: "border-t-warning" },
  { status: "offer",      label: "Offer",     color: "border-t-success" },
];

const NEXT_STATUS: Record<string, string> = {
  saved: "applied", applied: "screening", screening: "interview", interview: "offer",
};

const STATUS_VARIANT: Record<string, "primary" | "secondary" | "success" | "warning" | "error" | "neutral"> = {
  saved: "neutral", applied: "primary", screening: "secondary",
  interview: "warning", technical: "warning", offer: "success",
  rejected: "error", withdrawn: "neutral",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function AtsChip({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-green-500/15 text-green-400" :
    score >= 60 ? "bg-yellow-500/15 text-yellow-400" :
                  "bg-red-500/15 text-red-400";
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${color}`}>
      ATS {score}
    </span>
  );
}

function ResumeReadyChip({ atsScore }: { atsScore: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-400 border border-violet-500/20">
      <Sparkles className="h-2.5 w-2.5" />
      Resume ready{atsScore != null ? ` · ${atsScore}` : ""}
    </span>
  );
}

// ── Compact Kanban Card ───────────────────────────────────────────────────────

function KanbanCard({ app, onDelete, onStatusChange, onOpen }: {
  app: ApplicationData;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onOpen: (app: ApplicationData) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const next = NEXT_STATUS[app.status];

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirming) {
      onDelete(app.id);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 2500);
    }
  }

  return (
    <div
      onClick={() => onOpen(app)}
      className="p-3 rounded-xl bg-surface-container/60 border border-white/5 hover:border-white/10 hover:bg-surface-container-high/60 transition-all group cursor-pointer"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body-md font-medium text-on-surface truncate">{app.role}</p>
          <p className="text-label-sm text-on-surface-variant mt-0.5">{app.company}</p>
        </div>
        <button
          onClick={handleDelete}
          className={`h-6 px-1.5 rounded-md flex items-center gap-1 text-label-sm font-medium shrink-0 transition-all
            ${confirming
              ? "bg-error/20 text-error border border-error/30"
              : "text-on-surface-variant/40 hover:text-error hover:bg-error/10"}`}
          title={confirming ? "Click again to confirm" : "Delete"}
        >
          <X className="h-3 w-3" />
          {confirming && <span>Sure?</span>}
        </button>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <Badge variant={STATUS_VARIANT[app.status] ?? "neutral"} size="sm">
          {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
        </Badge>
        {app.has_resume && <ResumeReadyChip atsScore={app.ats_score} />}
        {app.job_url && (
          <a
            href={app.job_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-on-surface-variant/40 hover:text-primary transition-colors ml-auto"
            title="Open job posting"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-label-sm text-on-surface-variant/50">
          {new Date(app.applied_at).toLocaleDateString()}
        </p>
        {next && (
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange(app.id, next); }}
            className="text-label-sm text-primary/70 hover:text-primary transition-colors"
          >
            → {next}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function ApplicationDrawer({ app, onClose, onStatusChange }: {
  app: ApplicationData;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedResumeId, setActiveApplication, setTailoredContent } = useResumeLabStore();

  const [notes, setNotes] = useState(app.notes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);
  const [jdExpanded, setJdExpanded] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [tailorProgress, setTailorProgress] = useState("");
  const [tailorError, setTailorError] = useState("");

  // Fetch full detail (includes job_description)
  const { data: detail } = useQuery({
    queryKey: ["application", app.id],
    queryFn: () => api.applications.get(app.id),
    initialData: app,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.applications.update>[1]) =>
      api.applications.update(app.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["application", app.id] });
    },
  });

  async function saveNotes() {
    await updateMutation.mutateAsync({ notes });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  async function handleTailor() {
    setTailorError("");

    // Validate job description
    if (!detail?.job_description?.trim()) {
      setTailorError("Add a job description to this application first.");
      return;
    }

    // Resolve base resume ID — prefer already-selected, else fetch latest
    let resumeId = selectedResumeId;
    if (!resumeId) {
      try {
        const base = await api.resumes.getBase();
        resumeId = base.id;
      } catch {
        setTailorError("Upload a base resume first.");
        return;
      }
    }

    setActiveApplication(app.id);
    setIsTailoring(true);
    setTailorProgress("");

    try {
      let result = "";
      for await (const chunk of streamTailor({ resumeId, applicationId: app.id })) {
        result += chunk;
        setTailorProgress(result);
      }
      const parsed = parseJsonResponse(result);
      if (parsed) {
        setTailoredContent(parsed);
        router.push("/resume");
      } else {
        setTailorError("AI returned an invalid response — please try again.");
      }
    } catch {
      setTailorError("Tailoring failed. Please try again.");
    } finally {
      setIsTailoring(false);
      setTailorProgress("");
    }
  }

  const jd = detail?.job_description ?? "";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-surface-container border-l border-white/10 flex flex-col shadow-2xl overflow-hidden animate-slide-in-right">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-white/5 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-title-md font-display font-semibold text-on-surface truncate">{detail?.role}</p>
            <p className="text-body-sm text-on-surface-variant mt-0.5">{detail?.company}</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Status */}
          <div className="space-y-1.5">
            <p className="text-label-sm font-semibold text-on-surface-variant/60 uppercase tracking-wider">Status</p>
            <div className="flex flex-wrap gap-2">
              {COLUMNS.map((col) => (
                <button
                  key={col.status}
                  onClick={() => onStatusChange(app.id, col.status)}
                  className={`px-3 py-1.5 rounded-lg text-label-sm font-medium border transition-all
                    ${detail?.status === col.status
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-white/[0.03] border-white/10 text-on-surface-variant hover:border-white/20 hover:text-on-surface"}`}
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>

          {/* Job URL */}
          {detail?.job_url && (
            <div className="space-y-1.5">
              <p className="text-label-sm font-semibold text-on-surface-variant/60 uppercase tracking-wider">Job Posting</p>
              <a
                href={detail.job_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-body-sm text-primary hover:underline truncate"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{detail.job_url}</span>
              </a>
            </div>
          )}

          {/* Resume status */}
          <div className="space-y-1.5">
            <p className="text-label-sm font-semibold text-on-surface-variant/60 uppercase tracking-wider">Resume</p>
            {detail?.has_resume ? (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-label-sm font-medium text-violet-300">Tailored resume ready</p>
                  {detail.ats_score != null && (
                    <p className="text-body-xs text-on-surface-variant/60 mt-0.5">ATS score: {detail.ats_score}/100</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                <FileText className="h-4 w-4 text-on-surface-variant/40 shrink-0" />
                <p className="text-label-sm text-on-surface-variant/60">No tailored resume yet</p>
              </div>
            )}
          </div>

          {/* Job Description */}
          {jd && (
            <div className="space-y-1.5">
              <button
                onClick={() => setJdExpanded((v) => !v)}
                className="flex items-center gap-1.5 w-full text-left"
              >
                <p className="text-label-sm font-semibold text-on-surface-variant/60 uppercase tracking-wider flex-1">
                  Job Description
                </p>
                {jdExpanded
                  ? <ChevronUp className="h-3.5 w-3.5 text-on-surface-variant/40" />
                  : <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant/40" />
                }
              </button>
              <div
                className={`text-body-sm text-on-surface-variant whitespace-pre-wrap leading-relaxed overflow-hidden transition-all duration-300 rounded-lg bg-black/20 p-3
                  ${jdExpanded ? "max-h-[500px] overflow-y-auto" : "max-h-24"}`}
              >
                {jd}
              </div>
              {!jdExpanded && (
                <button
                  onClick={() => setJdExpanded(true)}
                  className="text-label-sm text-primary/70 hover:text-primary transition-colors"
                >
                  Show more
                </button>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <p className="text-label-sm font-semibold text-on-surface-variant/60 uppercase tracking-wider">Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Interview notes, contacts, follow-up actions..."
              rows={4}
              className="w-full px-3 py-2.5 rounded-lg bg-surface-container-high border border-outline-variant/40
                         text-body-sm text-on-surface placeholder:text-on-surface-variant/40
                         focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20
                         resize-none transition-all"
            />
            <button
              onClick={() => void saveNotes()}
              disabled={updateMutation.isPending || notes === (detail?.notes ?? "")}
              className="h-8 px-4 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20
                         text-primary text-label-sm font-medium transition-colors disabled:opacity-40"
            >
              {notesSaved ? "Saved ✓" : updateMutation.isPending ? "Saving…" : "Save Notes"}
            </button>
          </div>
        </div>

        {/* Footer — Tailor Resume CTA */}
        <div className="p-4 border-t border-white/5 shrink-0 space-y-2">
          {/* Streaming progress */}
          {isTailoring && (
            <div className="p-3 rounded-lg bg-surface-container border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                <p className="text-label-sm text-primary font-medium">
                  {!tailorProgress ? "Reading your resume…" :
                   tailorProgress.length < 200 ? "Analysing job description…" :
                   tailorProgress.length < 600 ? "Writing tailored bullets…" :
                   tailorProgress.length < 1200 ? "Optimising for ATS keywords…" :
                   "Finalising…"}
                </p>
              </div>
              {tailorProgress && (
                <div className="max-h-16 overflow-hidden rounded bg-black/20 px-2 py-1 text-[10px] text-on-surface-variant/30 font-mono leading-relaxed whitespace-pre-wrap select-none">
                  {tailorProgress.slice(-200)}
                </div>
              )}
            </div>
          )}

          {tailorError && (
            <p className="text-label-sm text-error px-1">{tailorError}</p>
          )}

          <button
            onClick={() => void handleTailor()}
            disabled={isTailoring}
            className="w-full h-10 rounded-xl font-medium text-label-lg flex items-center justify-center gap-2 transition-all
                       bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTailoring
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Tailoring…</>
              : <><Sparkles className="h-4 w-4" /> {detail?.has_resume ? "Re-tailor Resume" : "Tailor Resume"}</>
            }
          </button>

          {!jd && !isTailoring && (
            <p className="text-center text-body-sm text-on-surface-variant/40">
              Add a job description to this card to enable tailoring
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// ── Add Application Modal ─────────────────────────────────────────────────────

function AddApplicationModal({ onClose, onSubmit, isPending }: {
  onClose: () => void;
  onSubmit: (data: { company: string; role: string; job_url: string; job_description: string; status: string }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    company: "", role: "", job_url: "", job_description: "", status: "saved",
  });

  function patch(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const inputCls = "w-full px-3 py-2.5 rounded-lg bg-surface-container-high border border-outline-variant/40 text-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/40 transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-surface-container border border-white/10 rounded-2xl p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-title-md font-display font-semibold text-on-surface">Add Application</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            placeholder="Company *"
            value={form.company}
            onChange={(e) => patch("company", e.target.value)}
            className={inputCls}
          />
          <input
            placeholder="Role / Job Title *"
            value={form.role}
            onChange={(e) => patch("role", e.target.value)}
            className={inputCls}
          />
          <input
            placeholder="Job URL (optional)"
            value={form.job_url}
            onChange={(e) => patch("job_url", e.target.value)}
            className={inputCls}
            type="url"
          />
          <select
            value={form.status}
            onChange={(e) => patch("status", e.target.value)}
            className={inputCls}
          >
            {COLUMNS.map((c) => (
              <option key={c.status} value={c.status}>{c.label}</option>
            ))}
          </select>
          <div className="space-y-1">
            <p className="text-label-sm text-on-surface-variant/60">Job Description (optional)</p>
            <textarea
              placeholder="Paste the job description here..."
              value={form.job_description}
              onChange={(e) => patch("job_description", e.target.value)}
              rows={5}
              className={`${inputCls} resize-none`}
            />
          </div>
          <button
            onClick={() => onSubmit(form)}
            disabled={!form.company.trim() || !form.role.trim() || isPending}
            className="w-full h-10 rounded-lg bg-primary text-on-primary font-medium text-label-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {isPending ? "Adding..." : "Add Application"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Kanban Board ──────────────────────────────────────────────────────────────

export function KanbanBoard() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ApplicationData | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: () => api.applications.list(),
  });

  const createMutation = useMutation({
    mutationFn: (d: { company: string; role: string; job_url: string; job_description: string; status: string }) =>
      api.applications.create({
        ...d,
        job_url: d.job_url || undefined,
        job_description: d.job_description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setShowAdd(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.applications.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["applications"] });
      const previous = queryClient.getQueryData(["applications"]);
      queryClient.setQueryData(["applications"], (old: { applications: ApplicationData[] } | undefined) => ({
        applications: (old?.applications ?? []).filter((a) => a.id !== id),
      }));
      return { previous };
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(["applications"], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setSelectedApp(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.applications.update(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["applications"] });
      const previous = queryClient.getQueryData(["applications"]);
      queryClient.setQueryData(["applications"], (old: { applications: ApplicationData[] } | undefined) => ({
        applications: (old?.applications ?? []).map((a) => a.id === id ? { ...a, status } : a),
      }));
      // Also update selected app if it's the one being changed
      setSelectedApp((prev) => prev?.id === id ? { ...prev, status } : prev);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(["applications"], context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
  });

  const applications = data?.applications ?? [];
  const byStatus = (status: string) => applications.filter((a) => a.status === status);

  return (
    <>
      {showAdd && (
        <AddApplicationModal
          onClose={() => setShowAdd(false)}
          onSubmit={(d) => createMutation.mutate(d)}
          isPending={createMutation.isPending}
        />
      )}

      {selectedApp && (
        <ApplicationDrawer
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-label-md text-on-surface-variant">{applications.length} applications</p>
        <button
          onClick={() => setShowAdd(true)}
          className="h-9 px-4 rounded-lg bg-primary text-on-primary font-medium text-label-md hover:bg-primary/90 transition-colors"
        >
          + Add Application
        </button>
      </div>

      <div className="flex gap-4 h-[calc(100%-44px)] overflow-x-auto pb-4 no-scrollbar">
        {COLUMNS.map(({ status, label, color }) => {
          const cards = byStatus(status);
          return (
            <div key={status} className="flex flex-col gap-3 w-[260px] shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-label-md font-semibold text-on-surface">{label}</span>
                <span className="h-5 min-w-5 px-1.5 rounded-full bg-white/5 text-label-sm text-on-surface-variant flex items-center justify-center">
                  {cards.length}
                </span>
              </div>
              <GlassPanel
                variant="panel"
                className={`flex-1 min-h-[400px] p-2 space-y-2 border-t-2 ${color} rounded-xl overflow-y-auto no-scrollbar`}
              >
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-20 rounded-xl bg-white/[0.02] animate-pulse" />
                    ))}
                  </div>
                ) : cards.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-label-sm text-on-surface-variant/30">No applications</p>
                  </div>
                ) : (
                  cards.map((app) => (
                    <KanbanCard
                      key={app.id}
                      app={app}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      onStatusChange={(id, s) => statusMutation.mutate({ id, status: s })}
                      onOpen={setSelectedApp}
                    />
                  ))
                )}
              </GlassPanel>
            </div>
          );
        })}
      </div>
    </>
  );
}
