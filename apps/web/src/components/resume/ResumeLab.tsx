"use client";

import { useEffect } from "react";
import { useResumeLabStore, type TailoredContent } from "@/store/resumeLab";
import { api } from "@/lib/api";
import { ResumeUploader } from "./ResumeUploader";
import { ResumeList } from "./ResumeList";
import { ResumeSplitEditor } from "./ResumeSplitEditor";
import { GradientText } from "@applyflow/ui";

export function ResumeLab() {
  const { tailoredContent, tailoringInProgress, savedResumeId, openResume } = useResumeLabStore();

  // Handle "Open Resume" from the browser extension
  useEffect(() => {
    async function handleOpenResume(data: { resumeId: string; applicationId: string }) {
      try {
        const full = await api.resumes.get(data.resumeId);
        if (full.tailored_content) {
          openResume(full.id, data.applicationId, full.tailored_content as unknown as TailoredContent);
        }
      } catch { /* resume may have been deleted */ }
    }

    // Case 1: bridge ran before React mounted → data is in sessionStorage
    const raw = sessionStorage.getItem("af_open_resume");
    if (raw) {
      try {
        const data = JSON.parse(raw) as { resumeId: string; applicationId: string };
        sessionStorage.removeItem("af_open_resume");
        void handleOpenResume(data);
        return;
      } catch { /* ignore malformed */ }
    }

    // Case 2: React already mounted → listen for the custom event
    function onEvent(e: Event) {
      const data = (e as CustomEvent<{ resumeId: string; applicationId: string }>).detail;
      void handleOpenResume(data);
    }
    window.addEventListener("af_open_resume", onEvent);
    return () => window.removeEventListener("af_open_resume", onEvent);
  }, [openResume]);

  if (tailoredContent || tailoringInProgress) {
    return <ResumeSplitEditor />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-headline-md font-display font-bold text-on-surface">
          AI <GradientText>Resume Lab</GradientText>
        </h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          {savedResumeId
            ? "Select a resume to continue editing, or upload a new base resume."
            : "Upload your base resume, then tailor it to any job in seconds."}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <ResumeUploader />
        </div>
        <div className="lg:col-span-3">
          <ResumeList />
        </div>
      </div>
    </div>
  );
}
