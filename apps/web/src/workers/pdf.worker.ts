/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";

// Runs in a Web Worker — no DOM, but React + react-pdf work fine here.
// Receives render config, generates PDF bytes, transfers ArrayBuffer back.

type RenderRequest = {
  id: number;
  content: any;
  templateId: string;
  accentColor: string;
  fontStyle: string;
  compact: boolean;
  layout: Record<string, number>;
  sectionOrder: string[];
  columnMap?: Record<string, string>;
};

(self as any).onmessage = async (e: MessageEvent<RenderRequest>) => {
  const { id, content, templateId, accentColor, fontStyle, compact, layout, sectionOrder, columnMap } = e.data;
  try {
    const { pdf } = await import("@react-pdf/renderer");

    const props = { content, accentColor, fontStyle, compact, layout, sectionOrder, columnMap };

    let element: React.ReactElement<any>;
    if (templateId === "modern") {
      const { ModernTemplate } = await import("../components/resume/pdf/ModernTemplate");
      element = React.createElement(ModernTemplate, props as any);
    } else if (templateId === "minimal") {
      const { MinimalTemplate } = await import("../components/resume/pdf/MinimalTemplate");
      element = React.createElement(MinimalTemplate, props as any);
    } else if (templateId === "ats") {
      const { ATSSafeTemplate } = await import("../components/resume/pdf/ATSSafeTemplate");
      element = React.createElement(ATSSafeTemplate, props as any);
    } else if (templateId === "executive") {
      const { ExecutiveTemplate } = await import("../components/resume/pdf/ExecutiveTemplate");
      element = React.createElement(ExecutiveTemplate, props as any);
    } else {
      const { ClassicTemplate } = await import("../components/resume/pdf/ClassicTemplate");
      element = React.createElement(ClassicTemplate, props as any);
    }

    const blob = await pdf(element as any).toBlob();
    const buffer = await blob.arrayBuffer();
    (self as any).postMessage({ id, type: "done", buffer }, [buffer]);
  } catch (err) {
    (self as any).postMessage({ id, type: "error", message: String(err) });
  }
};
