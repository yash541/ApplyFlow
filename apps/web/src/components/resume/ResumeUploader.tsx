"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, X, Sparkles } from "lucide-react";
import { GlassPanel, Button } from "@applyflow/ui";
import { useQueryClient } from "@tanstack/react-query";
import { api, streamTailor } from "@/lib/api";
import { useResumeLabStore, type TailoredContent } from "@/store/resumeLab";

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
    setSelectedResume, setTailoredContent, setActiveApplication, clear,
  } = useResumeLabStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [isTailoring, setIsTailoring] = useState(false);
  const [streamPreview, setStreamPreview] = useState("");

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
    try {
      let result = "";
      // Prefer resume_id (DB lookup) over raw text when available
      for await (const chunk of streamTailor(
        selectedResumeId
          ? { resumeId: selectedResumeId, jobDescription: jobDesc }
          : { resumeText: selectedContent, jobDescription: jobDesc }
      )) {
        result += chunk;
        setStreamPreview(result);
      }
      const parsed = parseJsonResponse(result);
      if (parsed) {
        setTailoredContent(parsed);
        setStreamPreview("");
      } else {
        // AI didn't return valid JSON — show raw output as fallback
        setStreamPreview(result || "No response received.");
      }
    } catch {
      setStreamPreview("Error: could not connect to AI backend.");
    } finally {
      setIsTailoring(false);
    }
  };

  const hasResume = !!selectedContent;

  return (
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
          placeholder="Paste job description here..."
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
          onClick={() => void handleTailor()}
          disabled={isTailoring || !hasResume || !jobDesc.trim()}
        >
          <Sparkles className="h-4 w-4" />
          {isTailoring
            ? "AI Tailoring…"
            : hasResume
            ? "AI Tailor Resume"
            : "Select a resume first"}
        </Button>
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
  );
}
