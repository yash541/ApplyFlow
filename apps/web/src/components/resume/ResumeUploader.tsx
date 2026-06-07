"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, X, Sparkles, Search, Link2, Unlink } from "lucide-react";
import { GlassPanel, Button } from "@applyflow/ui";
import { useQueryClient } from "@tanstack/react-query";
import { api, streamTailor, type ApplicationData } from "@/lib/api";
import { broadcastInvalidate } from "@/lib/sync-channel";
import { useResumeLabStore, type TailoredContent } from "@/store/resumeLab";
import { createPortal } from "react-dom";
import { UpgradeModal } from "@/components/shared/UpgradeModal";
import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";

// ── Job link picker modal ─────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  saved: "#3b82f6", applied: "#6366f1", screening: "#6366f1",
  interview: "#f59e0b", technical: "#f59e0b",
  offer: "#10b981", rejected: "#ef4444",
};
const STATUS_LABEL: Record<string, string> = {
  saved: "Saved", applied: "Applied", screening: "Applied",
  interview: "Interview", technical: "Interview",
  offer: "Offer", rejected: "Rejected",
};

function JobLinkModal({
  preselectedId,
  prefillCompany,
  prefillRole,
  onConfirm,
  onCancel,
}: {
  preselectedId: string | null;
  prefillCompany?: string;
  prefillRole?: string;
  onConfirm: (applicationId: string | null) => void;
  onCancel: () => void;
}) {
  const [apps, setApps] = useState<ApplicationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(preselectedId);

  useEffect(() => {
    api.applications.list()
      .then(r => { setApps(r.applications); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = apps.filter(a => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q);
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f1f] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <div>
            <h2 className="text-sm font-semibold text-white/90">Which job is this resume for?</h2>
            <p className="text-xs text-white/40 mt-0.5">
              {(prefillCompany || prefillRole)
                ? `Tailoring for: ${prefillRole ?? ""}${prefillCompany ? ` at ${prefillCompany}` : ""}`
                : "Select a tracked application to link this tailored resume"}
            </p>
          </div>
          <button onClick={onCancel} className="h-7 w-7 flex items-center justify-center rounded-lg text-white/35 hover:text-white hover:bg-white/8 transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by company or role…"
              className="w-full h-8 pl-9 pr-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary/40"
            />
          </div>
        </div>

        {/* List */}
        <div className="px-4 pb-2 max-h-64 overflow-y-auto space-y-1" style={{ scrollbarWidth: "thin" }}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-white/30 text-center py-6">
              {search ? "No matching applications" : "No tracked applications yet"}
            </p>
          ) : (
            filtered.map(app => {
              const color = STATUS_COLOR[app.status] ?? "#6b7280";
              const label = STATUS_LABEL[app.status] ?? app.status;
              const isSelected = selected === app.id;
              return (
                <button
                  key={app.id}
                  onClick={() => setSelected(isSelected ? null : app.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all
                    ${isSelected
                      ? "bg-primary/12 border border-primary/30"
                      : "bg-white/[0.03] border border-transparent hover:bg-white/6 hover:border-white/8"}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white/90 truncate">{app.company}</div>
                    <div className="text-[11px] text-white/50 truncate">{app.role}</div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
                    {label}
                  </span>
                  {isSelected && <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="text-white text-[8px]">✓</span>
                  </div>}
                </button>
              );
            })
          )}
        </div>

        {/* No link option */}
        <div className="px-4 pb-3">
          <div className="h-px bg-white/6 my-2" />
          <button
            onClick={() => setSelected(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs transition-all
              ${selected === null
                ? "bg-white/8 border border-white/15 text-white/80"
                : "text-white/40 hover:text-white/60 hover:bg-white/4"}`}
          >
            <Unlink className="h-3.5 w-3.5 shrink-0" />
            No link — just tailor without tracking
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/6 bg-white/[0.02]">
          <button onClick={onCancel}
            className="h-8 px-4 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className="h-8 px-5 rounded-lg text-xs font-semibold bg-primary/90 hover:bg-primary text-white transition-all flex items-center gap-1.5"
          >
            <Sparkles className="h-3 w-3" />
            Tailor Resume →
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function parseJsonResponse(raw: string): TailoredContent | null {
  try {
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(cleaned) as TailoredContent;
  } catch {
    return null;
  }
}

export function ResumeUploader() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    selectedContent, selectedFilename, selectedResumeId,
    prefillJd, prefillCompany, prefillRole,
    setSelectedResume, setTailoredContent, setTailoringInProgress, setActiveApplication, clear,
  } = useResumeLabStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [isTailoring, setIsTailoring] = useState(false);
  const [streamPreview, setStreamPreview] = useState("");
  const [showJobPicker, setShowJobPicker] = useState(false);
  const { activeApplicationId } = useResumeLabStore();
  const { showUpgrade, upgradeReason, openUpgrade, closeUpgrade } = useUpgradePrompt();

  useEffect(() => {
    const raw = sessionStorage.getItem("af_tailor_prefill");
    if (raw) {
      try {
        const data = JSON.parse(raw) as { jd?: string; company?: string; role?: string; applicationId?: string };
        if (data?.jd) {
          useResumeLabStore.getState().setPrefill(data.jd, data.company, data.role);
          if (data.applicationId) useResumeLabStore.getState().setActiveApplication(data.applicationId);
          sessionStorage.removeItem("af_tailor_prefill");
          return;
        }
      } catch { /* ignore */ }
    }

    function handlePrefill(e: Event) {
      const data = (e as CustomEvent<{ jd?: string; company?: string; role?: string; applicationId?: string }>).detail;
      if (data?.jd) {
        useResumeLabStore.getState().setPrefill(data.jd, data.company, data.role);
        if (data.applicationId) useResumeLabStore.getState().setActiveApplication(data.applicationId);
        sessionStorage.removeItem("af_tailor_prefill");
      }
    }
    window.addEventListener("af_prefill_ready", handlePrefill);
    return () => window.removeEventListener("af_prefill_ready", handlePrefill);
  }, []);

  useEffect(() => {
    if (prefillJd) setJobDesc(prefillJd);
  }, [prefillJd]);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(pdf|docx|txt)$/i)) {
      setUploadError("Only PDF, DOCX, or TXT files supported");
      return;
    }
    setUploadError("");
    setIsUploading(true);
    try {
      // Upload returns full detail (content included) — no second fetch needed
      const resume = await api.resumes.upload(file);
      setSelectedResume(resume.content ?? "", resume.filename ?? resume.name, resume.id);
      await queryClient.invalidateQueries({ queryKey: ["resumes"] });
      broadcastInvalidate(["resumes"]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }, []);

  const handleTailor = async () => {
    if (!selectedContent || !jobDesc.trim()) return;

    setStreamPreview("");
    setTailoredContent(null);
    setIsTailoring(true);
    setTailoringInProgress(true);

    // Abort after 90s — handles Railway cold starts that never respond
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    try {
      let result = "";
      for await (const chunk of streamTailor(
        selectedResumeId
          ? { resumeId: selectedResumeId, jobDescription: jobDesc }
          : { resumeText: selectedContent, jobDescription: jobDesc },
        controller.signal,
      )) {
        result += chunk;
        setStreamPreview(result);
      }
      const parsed = parseJsonResponse(result);
      if (parsed) {
        setTailoredContent(parsed);
        setStreamPreview("");
      } else {
        // AI returned non-JSON — reset loading state so user isn't stuck
        setTailoringInProgress(false);
        setStreamPreview(result || "No response received. Please try again.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTailoringInProgress(false);
      if (msg.includes("402") || msg.includes("usage_limit")) {
        openUpgrade("You've hit your usage limit. Upgrade to Pro for unlimited access.");
      } else if (msg.includes("abort") || msg.includes("AbortError")) {
        setStreamPreview("Request timed out. The server may be starting up — please try again.");
      } else {
        setStreamPreview("Error: could not connect to AI backend. Please try again.");
      }
    } finally {
      clearTimeout(timeout);
      setIsTailoring(false);
    }
  };

  const hasResume = !!selectedContent;

  return (
    <>
    <UpgradeModal open={showUpgrade} onClose={closeUpgrade} reason={upgradeReason} />
    <GlassPanel variant="card" className="p-5 space-y-4">
      <h2 className="text-title-md font-display font-semibold text-on-surface">Upload Resume</h2>

      {hasResume ? (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-label-sm text-primary font-medium flex-1 truncate">{selectedFilename}</span>
          <button
            onClick={() => { clear(); setJobDesc(""); setStreamPreview(""); }}
            className="text-primary/60 hover:text-primary transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
            ${isDragging ? "border-primary/60 bg-primary/5" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"}`}
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Upload className="h-6 w-6 text-primary" />
            </div>
          )}
          <div className="text-center">
            <p className="text-body-md font-medium text-on-surface">
              {isUploading ? "Parsing resume..." : "Drop your resume here"}
            </p>
            <p className="text-label-sm text-on-surface-variant/60 mt-1">PDF, DOCX, or TXT — up to 5MB</p>
          </div>
          {!isUploading && (
            <>
              <Button variant="glass" size="sm" onClick={() => fileInputRef.current?.click()}>
                <FileText className="h-3.5 w-3.5" />
                Browse files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              />
            </>
          )}
        </div>
      )}

      {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}

      {(prefillCompany || prefillRole) && (
        <p className="text-label-sm text-primary/80">
          ⚡ Tailoring for: <strong>{prefillRole}</strong>{prefillCompany ? ` at ${prefillCompany}` : ""}
        </p>
      )}

      <div className="space-y-3">
        <p className="text-label-md font-semibold text-on-surface">Job Description</p>

        {/* Show prompt when arrived from extension but JD is missing/empty */}
        {(prefillCompany || prefillRole) && !jobDesc.trim() && (
          <div className="flex items-start gap-3 px-3 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-fade-in">
            <span className="text-amber-400 text-base shrink-0 mt-0.5">⚠️</span>
            <div>
              <p className="text-label-sm font-semibold text-amber-300">Job description missing</p>
              <p className="text-label-sm text-on-surface-variant/70 mt-0.5">
                Paste the job description below so the AI can tailor your resume to this specific role.
              </p>
            </div>
          </div>
        )}

        {/* Quality warning — shown when JD has content, prominent amber style */}
        {jobDesc.trim().length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/12 border border-amber-500/40 shadow-sm">
            <span className="text-amber-400 text-base shrink-0 mt-0.5">⚠️</span>
            <div className="space-y-0.5">
              <p className="text-label-sm font-semibold text-amber-300">
                Better JD = Better Resume
              </p>
              <p className="text-label-sm text-amber-200/70 leading-relaxed">
                Include specific skills, responsibilities, and requirements — not just a summary. The AI uses every keyword to tailor your bullets.
              </p>
            </div>
          </div>
        )}

        <textarea
          value={jobDesc}
          onChange={(e) => setJobDesc(e.target.value)}
          placeholder="Paste job description here...or guide ApplyFlow to improve your resume with specific instructions like 'Tailor for a software engineering role at a FAANG company, focusing on leadership and impact.'"
          rows={5}
          className={`w-full px-3 py-2.5 rounded-lg bg-surface-container text-body-sm text-on-surface
                     placeholder:text-on-surface-variant/40 focus:outline-none resize-none transition-all
                     ${(prefillCompany || prefillRole) && !jobDesc.trim()
                       ? "border border-amber-500/50 focus:border-amber-400/70 focus:ring-1 focus:ring-amber-400/20"
                       : "border border-outline-variant/40 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                     }`}
        />
        <Button
          variant="primary"
          className="w-full"
          onClick={() => {
            if (!isTailoring && hasResume && jobDesc.trim()) setShowJobPicker(true);
          }}
          disabled={isTailoring || !hasResume || !jobDesc.trim()}
        >
          <Sparkles className="h-4 w-4" />
          {isTailoring
            ? "AI Tailoring…"
            : hasResume
            ? "AI Tailor Resume"
            : "Select a resume first"}
        </Button>

        {/* Job link acknowledgment modal */}
        {showJobPicker && (
          <JobLinkModal
            preselectedId={activeApplicationId ?? null}
            prefillCompany={prefillCompany}
            prefillRole={prefillRole}
            onCancel={() => setShowJobPicker(false)}
            onConfirm={(applicationId) => {
              setShowJobPicker(false);
              // Set the confirmed application link before tailoring
              if (applicationId) setActiveApplication(applicationId);
              else setActiveApplication("");
              void handleTailor();
            }}
          />
        )}
      </div>

      {/* Streaming progress — shows live output so user sees real progress */}
      {isTailoring && (
        <div className="p-3 rounded-lg bg-surface-container border border-white/10 space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
            <p className="text-label-sm text-primary font-medium">
              {!streamPreview ? "Analyzing resume…" :
               streamPreview.length < 200 ? "Reading job description…" :
               streamPreview.length < 600 ? "Writing tailored bullets…" :
               streamPreview.length < 1200 ? "Optimising for ATS keywords…" :
               "Finalising…"}
            </p>
          </div>
          {streamPreview && (
            <div className="max-h-24 overflow-hidden rounded bg-black/20 px-2 py-1.5 text-[10px] text-on-surface-variant/40 font-mono leading-relaxed whitespace-pre-wrap select-none">
              {streamPreview.slice(-300)}
            </div>
          )}
        </div>
      )}

      {/* Raw fallback when AI didn't return structured JSON */}
      {!isTailoring && streamPreview && (
        <div className="p-3 rounded-lg bg-surface-container border border-white/10 text-body-sm text-on-surface-variant whitespace-pre-wrap max-h-48 overflow-y-auto">
          {streamPreview}
        </div>
      )}
    </GlassPanel>
    </>
  );
}
