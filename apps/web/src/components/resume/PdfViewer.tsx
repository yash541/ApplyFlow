"use client";

// Loaded via next/dynamic with ssr:false — react-pdf only runs in the browser.
import React, { useState, useEffect, useRef } from "react";
import { pdf } from "@react-pdf/renderer";
import { Loader2 } from "lucide-react";
import { ClassicTemplate } from "./pdf/ClassicTemplate";
import { ModernTemplate } from "./pdf/ModernTemplate";
import { MinimalTemplate } from "./pdf/MinimalTemplate";
import { ATSSafeTemplate } from "./pdf/ATSSafeTemplate";
import { ExecutiveTemplate } from "./pdf/ExecutiveTemplate";
import { JakesTemplate } from "./pdf/JakesTemplate";
import { DEFAULT_SECTION_ORDER, type TemplateProps } from "./pdf/shared";
import type { TemplateId } from "@/store/resumeLab";

export interface PdfViewerProps extends TemplateProps {
  templateId: TemplateId;
  onBlobReady?: (blob: Blob) => void;
}

export function PdfViewer({
  templateId,
  content,
  accentColor,
  fontStyle,
  compact,
  layout = {},
  sectionOrder = DEFAULT_SECTION_ORDER,
  columnMap,
  onBlobReady,
}: PdfViewerProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const activeUrlRef = useRef<string | null>(null);

  // Content changes are debounced here so rapid keystrokes don't re-render on every key.
  // All other props (layout, template, colors) fire the PDF effect immediately.
  const [debouncedContent, setDebouncedContent] = useState(content);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedContent(content), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // Stable string keys for object/array props so the effect uses value-equality, not reference.
  const layoutKey = JSON.stringify(layout);
  const orderKey  = sectionOrder.join(",");
  const colKey    = JSON.stringify(columnMap ?? null);

  useEffect(() => {
    let cancelled = false;
    setIsRendering(true);

    const tplProps = { content: debouncedContent, accentColor, fontStyle, compact, layout, sectionOrder, columnMap };

    const doc =
      templateId === "modern"    ? <ModernTemplate    {...tplProps} /> :
      templateId === "minimal"   ? <MinimalTemplate   {...tplProps} /> :
      templateId === "ats"       ? <ATSSafeTemplate   {...tplProps} /> :
      templateId === "executive" ? <ExecutiveTemplate {...tplProps} /> :
      templateId === "jakes"     ? <JakesTemplate     {...tplProps} /> :
                                   <ClassicTemplate   {...tplProps} />;

    pdf(doc).toBlob()
      .then(blob => {
        if (cancelled) return;
        onBlobReady?.(blob);
        const url = URL.createObjectURL(blob);
        if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = url;
        setDisplayUrl(url);
        setIsRendering(false);
      })
      .catch(err => {
        console.error("[PdfViewer] generation failed:", err);
        if (!cancelled) setIsRendering(false);
      });

    return () => { cancelled = true; };
  }, [
    // Content via debounced copy — 300ms after typing stops.
    debouncedContent,
    // All style/layout changes fire immediately.
    templateId, accentColor, fontStyle, compact,
    // String keys for objects — effect re-runs when VALUES change, not just references.
    layoutKey, orderKey, colKey,
  ]);

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => { if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current); };
  }, []);

  if (!displayUrl) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full gap-3 text-on-surface-variant/50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Rendering PDF…</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <iframe
        src={`${displayUrl}#toolbar=0&navpanes=0`}
        className={`w-full h-full border-0 transition-opacity duration-300 ${isRendering ? "opacity-50" : "opacity-100"}`}
        title="Resume PDF"
      />
      {isRendering && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm pointer-events-none">
          <Loader2 className="h-3 w-3 animate-spin text-white/50" />
          <span className="text-[10px] text-white/40">Updating…</span>
        </div>
      )}
    </div>
  );
}
