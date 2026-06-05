"use client";

import React, { useState } from "react";
import {
  FileText, Trash2, Clock, Wand2, Sparkles, Pencil,
  Eye, Lock, X, Loader2, Download,
} from "lucide-react";
import dynamic from "next/dynamic";
import { GlassPanel } from "@applyflow/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ResumeData } from "@/lib/api";
import { broadcastInvalidate } from "@/lib/sync-channel";
import { useResumeLabStore, type TailoredContent } from "@/store/resumeLab";
import { DEFAULT_SECTION_ORDER } from "./pdf/shared";
import { UpgradeModal } from "@/components/shared/UpgradeModal";
import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";

// react-pdf is browser-only — load without SSR
const PdfViewer = dynamic(
  () => import("./PdfViewer").then((m) => ({ default: m.PdfViewer })),
  { ssr: false },
);

// Application statuses that lock editing (already sent)
const LOCKED_STATUSES = new Set(["applied", "screening", "interview", "technical", "offer"]);

const STATUS_LABELS: Record<string, string> = {
  saved: "Saved", applied: "Applied", screening: "Applied",
  interview: "Interview", technical: "Interview", offer: "Offer",
};

const STATUS_COLORS: Record<string, string> = {
  saved: "bg-blue-500/15 text-blue-400",
  applied: "bg-green-500/15 text-green-400",
  screening: "bg-green-500/15 text-green-400",
  interview: "bg-amber-500/15 text-amber-400",
  technical: "bg-amber-500/15 text-amber-400",
  offer: "bg-violet-500/15 text-violet-400",
};

type ViewPayload =
  | { type: "tailored"; resume: ResumeData; content: TailoredContent }
  | { type: "base"; resume: ResumeData; text: string };

// ── PDF Viewer Modal ──────────────────────────────────────────────────────────

function ResumeViewerModal({ payload, onClose }: { payload: ViewPayload; onClose: () => void }) {
  const { selectedTemplate, accentColor, fontStyle, editorPrefs } = useResumeLabStore();

  // Close on backdrop click or Escape
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Build visible section order (hidden sections excluded)
  const sectionOrder = (() => {
    const base = editorPrefs.sectionOrder.length > 0
      ? editorPrefs.sectionOrder
      : [
          ...DEFAULT_SECTION_ORDER,
          ...(payload.type === "tailored"
            ? (payload.content.customSections ?? []).map((s) => s.id)
            : []),
        ];
    const hidden = new Set(editorPrefs.hiddenSections);
    return base.filter((id) => !hidden.has(id));
  })();

  return (
    <div
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div className="relative flex flex-col w-full max-w-3xl h-[92vh] bg-[#141414] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-2.5">
            {payload.type === "tailored"
              ? <Sparkles className="h-4 w-4 text-violet-400" />
              : <FileText className="h-4 w-4 text-primary" />
            }
            <span className="text-sm font-medium text-on-surface/80 truncate max-w-sm">
              {payload.resume.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-on-surface-variant/50 hover:text-on-surface hover:bg-white/8 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0">
          {payload.type === "tailored" ? (
            <PdfViewer
              content={payload.content}
              templateId={selectedTemplate}
              accentColor={accentColor}
              fontStyle={fontStyle}
              compact={editorPrefs.compact}
              layout={editorPrefs.layout}
              sectionOrder={sectionOrder}
              columnMap={editorPrefs.columnMap}
            />
          ) : (
            <div className="h-full overflow-auto p-6">
              <pre className="text-sm text-on-surface-variant/80 whitespace-pre-wrap leading-relaxed font-mono">
                {payload.text || "No content available."}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main list ─────────────────────────────────────────────────────────────────

export function ResumeList() {
  const queryClient = useQueryClient();
  const { selectedResumeId, setSelectedResume, openResume } = useResumeLabStore();
  const { showUpgrade, upgradeReason, openUpgrade, closeUpgrade } = useUpgradePrompt();

  const [viewPayload, setViewPayload] = useState<ViewPayload | null>(null);
  const [viewLoadingId, setViewLoadingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: resumeData, isLoading: resumesLoading } = useQuery({
    queryKey: ["resumes"],
    queryFn: () => api.resumes.list(),
  });

  // Fetch applications to know which statuses lock editing
  const { data: appsData } = useQuery({
    queryKey: ["applications"],
    queryFn: () => api.applications.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.resumes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      broadcastInvalidate(["resumes"]);
    },
  });

  // Build applicationId → ApplicationData lookup
  const appMap = React.useMemo(() => {
    const map: Record<string, { status: string; company: string; role: string }> = {};
    for (const app of appsData?.applications ?? []) {
      map[app.id] = { status: app.status, company: app.company, role: app.role };
    }
    return map;
  }, [appsData]);

  function canEditResume(resume: ResumeData): boolean {
    if (resume.type === "base") return false; // base resumes don't open in editor
    if (!resume.application_id) return true;  // no linked app → editable
    const status = appMap[resume.application_id]?.status;
    return !status || !LOCKED_STATUSES.has(status);
  }

  function getAppStatus(resume: ResumeData): string | null {
    if (!resume.application_id) return null;
    return appMap[resume.application_id]?.status ?? null;
  }

  async function handleView(resume: ResumeData) {
    setViewLoadingId(resume.id);
    try {
      const full = await api.resumes.get(resume.id);
      if (resume.type === "tailored" && full.tailored_content) {
        setViewPayload({
          type: "tailored",
          resume,
          content: full.tailored_content as unknown as TailoredContent,
        });
      } else {
        setViewPayload({ type: "base", resume, text: full.content ?? "" });
      }
    } finally {
      setViewLoadingId(null);
    }
  }

  async function handleUse(resume: ResumeData) {
    setLoadingId(resume.id);
    try {
      const full = await api.resumes.get(resume.id);
      setSelectedResume(full.content ?? "", full.name, full.id);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDownload(resume: ResumeData) {
    setDownloadingId(resume.id);
    try {
      const { pdf_bytes } = await api.resumes.getPdfBytes(resume.id);
      if (!pdf_bytes) return;
      const binary = atob(pdf_bytes);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${resume.name.replace(/[^a-zA-Z0-9-_ ]/g, "")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      // Reflect downloaded=true immediately without waiting for a refetch
      queryClient.setQueryData<{ resumes: ResumeData[] }>(["resumes"], old =>
        old ? { resumes: old.resumes.map(r => r.id === resume.id ? { ...r, downloaded: true } : r) } : old
      );
      broadcastInvalidate(["resumes"], ["billing-usage"]);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 402) {
        openUpgrade("resume_downloads");
      }
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleEdit(resume: ResumeData) {
    if (!canEditResume(resume)) return;
    setLoadingId(resume.id);
    try {
      const full = await api.resumes.get(resume.id);
      if (full.tailored_content) {
        openResume(
          full.id,
          full.application_id ?? "",
          full.tailored_content as unknown as TailoredContent,
        );
      }
    } finally {
      setLoadingId(null);
    }
  }

  const resumes = resumeData?.resumes ?? [];
  const baseResumes     = resumes.filter((r) => r.type === "base");
  const tailoredResumes = resumes.filter((r) => r.type === "tailored" && !!r.application_id);
  const generalResumes  = resumes.filter((r) => r.type === "tailored" && !r.application_id);

  if (resumesLoading) {
    return (
      <GlassPanel variant="card" className="p-5">
        <h2 className="text-title-md font-display font-semibold text-on-surface mb-4">Your Resumes</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-white/[0.02] border border-white/5 animate-pulse" />
          ))}
        </div>
      </GlassPanel>
    );
  }

  /* Upgrade modal (triggered on download limit hit) */
  const upgradeModal = (
    <UpgradeModal open={showUpgrade} onClose={closeUpgrade} reason={upgradeReason} />
  );

  return (
    <>
      {upgradeModal}
      <GlassPanel variant="card" className="p-5 space-y-6">
        <h2 className="text-title-md font-display font-semibold text-on-surface">Your Resumes</h2>

        {resumes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-10 w-10 text-on-surface-variant/30 mb-3" />
            <p className="text-body-md text-on-surface-variant/60">No resumes yet</p>
            <p className="text-label-sm text-on-surface-variant/40 mt-1">
              Upload a base resume on the left to get started
            </p>
          </div>
        ) : (
          <>
            {/* Base resumes */}
            {baseResumes.length > 0 && (
              <div className="space-y-2">
                <p className="text-label-sm font-semibold text-on-surface-variant/60 uppercase tracking-wider">
                  Base Resumes
                </p>
                {baseResumes.map((resume) => (
                  <ResumeRow
                    key={resume.id}
                    resume={resume}
                    isSelected={resume.id === selectedResumeId}
                    isLoading={loadingId === resume.id}
                    isViewLoading={viewLoadingId === resume.id}
                    appStatus={null}
                    canEdit={false}
                    onUse={() => void handleUse(resume)}
                    onEdit={() => void handleEdit(resume)}
                    onView={() => void handleView(resume)}
                    onDelete={() => deleteMutation.mutate(resume.id)}
                  />
                ))}
              </div>
            )}

            {/* General resumes — between Base and Tailored */}
            {generalResumes.length > 0 && (
              <div className="space-y-2">
                <p className="text-label-sm font-semibold text-on-surface-variant/60 uppercase tracking-wider">
                  General Resumes
                </p>
                <p className="text-[11px] text-on-surface-variant/40 -mt-1">
                  AI-tailored but not linked to a specific job
                </p>
                {generalResumes.map((resume) => (
                  <ResumeRow
                    key={resume.id}
                    resume={resume}
                    isSelected={false}
                    isLoading={loadingId === resume.id}
                    isViewLoading={viewLoadingId === resume.id}
                    isDownloading={downloadingId === resume.id}
                    appStatus={null}
                    canEdit={true}
                    onUse={() => {}}
                    onEdit={() => void handleEdit(resume)}
                    onView={() => void handleView(resume)}
                    onDownload={() => void handleDownload(resume)}
                    onDelete={() => deleteMutation.mutate(resume.id)}
                  />
                ))}
              </div>
            )}

            {/* Tailored resumes — linked to a specific job */}
            {tailoredResumes.length > 0 && (
              <div className="space-y-2">
                <p className="text-label-sm font-semibold text-on-surface-variant/60 uppercase tracking-wider">
                  Tailored Resumes
                </p>
                {tailoredResumes.map((resume) => (
                  <ResumeRow
                    key={resume.id}
                    resume={resume}
                    isSelected={false}
                    isLoading={loadingId === resume.id}
                    isViewLoading={viewLoadingId === resume.id}
                    isDownloading={downloadingId === resume.id}
                    appStatus={getAppStatus(resume)}
                    canEdit={canEditResume(resume)}
                    onUse={() => {}}
                    onEdit={() => void handleEdit(resume)}
                    onView={() => void handleView(resume)}
                    onDownload={() => void handleDownload(resume)}
                    onDelete={() => deleteMutation.mutate(resume.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </GlassPanel>

      {viewPayload && (
        <ResumeViewerModal payload={viewPayload} onClose={() => setViewPayload(null)} />
      )}
    </>
  );
}

// ── Resume row ────────────────────────────────────────────────────────────────

interface ResumeRowProps {
  resume: ResumeData;
  isSelected: boolean;
  isLoading: boolean;
  isViewLoading: boolean;
  isDownloading?: boolean;
  appStatus: string | null;
  canEdit: boolean;
  onUse: () => void;
  onEdit: () => void;
  onView: () => void;
  onDownload?: () => void;
  onDelete: () => void;
}

function ResumeRow({
  resume, isSelected, isLoading, isViewLoading, isDownloading = false,
  appStatus, canEdit,
  onUse, onEdit, onView, onDownload, onDelete,
}: ResumeRowProps) {
  const isTailored = resume.type === "tailored";
  const isLocked = isTailored && !!appStatus && LOCKED_STATUSES.has(appStatus);

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all
        ${isSelected
          ? "bg-primary/10 border-primary/30"
          : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"}`}
    >
      {/* Icon */}
      <div
        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border
          ${isTailored
            ? "bg-violet-500/10 border-violet-500/20"
            : isSelected
            ? "bg-primary/20 border-primary/30"
            : "bg-primary/10 border-primary/20"}`}
      >
        {isTailored
          ? <Sparkles className="h-5 w-5 text-violet-400" />
          : <FileText className="h-5 w-5 text-primary" />
        }
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-body-md font-medium text-on-surface truncate">{resume.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-label-sm text-on-surface-variant flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(resume.updated_at).toLocaleDateString()}
          </span>
          {isTailored && resume.ats_score != null && (
            <AtsChip score={resume.ats_score} />
          )}
          {/* Downloaded badge */}
          {isTailored && resume.downloaded && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/12 text-emerald-400 border border-emerald-500/20">
              ↓ Downloaded
            </span>
          )}
          {/* Application status pill */}
          {appStatus && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${STATUS_COLORS[appStatus] ?? "bg-white/10 text-on-surface-variant/60"}`}>
              {STATUS_LABELS[appStatus] ?? appStatus}
            </span>
          )}
          {/* Lock label for submitted applications */}
          {isLocked && (
            <span className="text-[10px] text-on-surface-variant/40 flex items-center gap-0.5">
              <Lock className="h-2.5 w-2.5" /> View only
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* View button — always visible */}
        <button
          onClick={onView}
          disabled={isViewLoading}
          title="Preview resume"
          className="h-8 w-8 rounded-lg border border-white/10 flex items-center justify-center text-on-surface-variant/50 hover:text-on-surface hover:bg-white/8 transition-colors disabled:opacity-40"
        >
          {isViewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
        </button>

        {/* Download button — all saved tailored resumes */}
        {isTailored && onDownload && (
          <button
            onClick={onDownload}
            disabled={isDownloading}
            title="Download PDF"
            className="h-8 w-8 rounded-lg border border-white/10 flex items-center justify-center text-on-surface-variant/50 hover:text-green-400 hover:border-green-500/30 hover:bg-green-500/8 transition-colors disabled:opacity-40"
          >
            {isDownloading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />
            }
          </button>
        )}

        {/* Primary action */}
        {isTailored ? (
          canEdit ? (
            <button
              onClick={onEdit}
              disabled={isLoading}
              className="h-8 px-3 rounded-lg border flex items-center gap-1.5 text-label-sm font-medium transition-colors disabled:opacity-50
                bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20 text-violet-300"
            >
              {isLoading ? "Loading…" : <><Pencil className="h-3.5 w-3.5" /> Edit</>}
            </button>
          ) : (
            // Submitted — edit disabled
            <span className="h-8 px-3 rounded-lg border border-white/8 flex items-center gap-1.5 text-label-sm text-on-surface-variant/30 cursor-not-allowed">
              <Lock className="h-3.5 w-3.5" /> Locked
            </span>
          )
        ) : (
          isSelected ? (
            <span className="text-label-sm text-primary font-medium px-2 py-1 rounded-lg bg-primary/10">
              Selected
            </span>
          ) : (
            <button
              onClick={onUse}
              disabled={isLoading}
              className="h-8 px-3 rounded-lg border flex items-center gap-1.5 text-label-sm font-medium transition-colors disabled:opacity-50
                bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary"
            >
              {isLoading ? "Loading…" : <><Wand2 className="h-3.5 w-3.5" /> Use</>}
            </button>
          )
        )}

        <button
          onClick={onDelete}
          className="h-8 w-8 rounded-lg hover:bg-error/10 flex items-center justify-center text-on-surface-variant hover:text-error transition-colors"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

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
