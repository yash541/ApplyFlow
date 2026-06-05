"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Save, Loader2, Pencil, Check, X, GripVertical, Eye, EyeOff,
  ArrowLeft, Sparkles, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Plus,
  SlidersHorizontal, Trash2,
} from "lucide-react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api, rewriteBullet } from "@/lib/api";
import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";
import { UpgradeModal } from "@/components/shared/UpgradeModal";
import {
  useResumeLabStore, type TailoredContent, type TemplateId, type FontStyle,
  type CustomSection, type EditorPrefs,
} from "@/store/resumeLab";
import {
  analyzeContent, DEFAULT_SECTION_ORDER, getSectionLabel, flattenSkills, autoGroupSkills,
} from "./pdf/shared";

const PdfViewer = dynamic(
  () => import("./PdfViewer").then(m => ({ default: m.PdfViewer })),
  { ssr: false },
);

type LayoutOverrides = EditorPrefs["layout"];

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENT_COLORS = [
  { hex: "#2563eb", label: "Blue" },
  { hex: "#0d9488", label: "Teal" },
  { hex: "#7c3aed", label: "Purple" },
  { hex: "#ea580c", label: "Amber" },
  { hex: "#16a34a", label: "Green" },
  { hex: "#475569", label: "Slate" },
];

const TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "modern", label: "Modern" },
  { id: "minimal", label: "Minimal" },
  { id: "ats", label: "ATS" },
  { id: "executive", label: "Exec" },
];

// ─── Editable primitives ──────────────────────────────────────────────────────
// ─── Centered edit modal (replaces inline editing) ───────────────────────────

function EditModal({
  isOpen, label, value, placeholder = "", minHeight = 140,
  regenContext, onSave, onCancel,
}: {
  isOpen: boolean;
  label: string;
  value: string;
  placeholder?: string;
  minHeight?: number;
  /** When provided, shows a ✨ Regenerate button */
  regenContext?: { jobDescription?: string; role?: string };
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [original, setOriginal] = useState(value);   // for undo after regen
  const [regenerated, setRegenerated] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setDraft(value);
      setOriginal(value);
      setRegenerated(false);
      setRegenError("");
    }
  }, [isOpen, value]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSave(draft); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, draft, onSave, onCancel]);

  async function handleRegenerate() {
    if (!regenContext || regenerating) return;
    setRegenerating(true);
    setRegenError("");
    try {
      const result = await rewriteBullet({
        bullet: draft,
        jobDescription: regenContext.jobDescription,
        role: regenContext.role,
      });
      setDraft(result);
      setRegenerated(true);
    } catch {
      setRegenError("Regeneration failed — please try again.");
    } finally {
      setRegenerating(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onCancel}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[201] flex items-center justify-center p-6 pointer-events-none">
            <motion.div
              className="w-full max-w-2xl pointer-events-auto overflow-hidden rounded-2xl border border-white/10 bg-surface-container shadow-2xl"
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 14 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
                <p className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant/50">
                  {label}
                </p>
                <button
                  onClick={onCancel}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant/40 transition-colors hover:bg-white/5 hover:text-on-surface"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Textarea */}
              <div className="px-5 pt-4 pb-3">
                <div className="relative">
                  <textarea
                    autoFocus={!regenerating}
                    value={draft}
                    placeholder={placeholder}
                    disabled={regenerating}
                    onChange={e => setDraft(e.target.value)}
                    className="w-full resize-none rounded-xl border border-outline-variant/40 bg-surface-container-high px-4 py-3
                               text-body-md text-on-surface placeholder:text-on-surface-variant/40 leading-relaxed
                               focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all
                               disabled:opacity-40 disabled:cursor-wait"
                    style={{ minHeight }}
                  />
                  {/* Regenerating overlay */}
                  {regenerating && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-surface-container-high/80">
                      <div className="flex items-center gap-2 text-label-sm text-primary">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Rewriting with AI…
                      </div>
                    </div>
                  )}
                </div>

                {/* Undo + error row */}
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[11px] text-on-surface-variant/30">
                    <kbd className="font-mono">⌘↵</kbd> save · <kbd className="font-mono">Esc</kbd> cancel ·{" "}
                    <span className="font-mono">[text](url)</span> for links
                  </p>
                  {regenerated && (
                    <button
                      onClick={() => { setDraft(original); setRegenerated(false); }}
                      className="flex items-center gap-1 text-[11px] text-on-surface-variant/50 hover:text-on-surface-variant transition-colors"
                    >
                      ↩ Undo regen
                    </button>
                  )}
                </div>
                {regenError && (
                  <p className="mt-1 text-[11px] text-red-400">{regenError}</p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center border-t border-white/5 bg-black/10 px-5 py-4">
                {/* Left: Regenerate */}
                {regenContext && (
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/8 px-4 h-9
                               text-label-md text-primary transition-all hover:bg-primary/15 disabled:opacity-40 disabled:cursor-wait"
                  >
                    {regenerating
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Rewriting…</>
                      : <><Sparkles className="h-3.5 w-3.5" /> Regenerate</>
                    }
                  </button>
                )}

                {/* Right: Cancel + Save */}
                <div className="ml-auto flex items-center gap-3">
                  <button
                    onClick={onCancel}
                    className="h-9 rounded-lg border border-white/10 px-5 text-label-md text-on-surface-variant transition-colors hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onSave(draft)}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-5 font-medium text-label-md text-on-primary transition-colors hover:bg-primary/90"
                  >
                    <Check className="h-3.5 w-3.5" /> Save
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function EditableField({
  value, onSave, placeholder = "Click to edit", className = "",
}: {
  value: string; onSave: (v: string) => void; placeholder?: string; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        rows={1}
        onChange={e => {
          setDraft(e.target.value);
          // Auto-resize: shrink then grow to fit content
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        onFocus={e => {
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        onBlur={() => { onSave(draft); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
          // Enter saves only if Shift not held; Shift+Enter inserts newline
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(draft); setEditing(false); }
        }}
        className={`bg-surface-container-high border border-primary/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/40 w-full resize-none overflow-hidden leading-snug ${className}`}
        style={{ minHeight: "1.75rem" }}
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`cursor-text group/field inline-flex items-center gap-1 hover:text-on-surface transition-colors ${className} ${!value ? "italic opacity-40" : ""}`}
    >
      {value || placeholder}
      <Pencil className="h-2.5 w-2.5 opacity-60 group-hover/field:opacity-100 transition-opacity shrink-0" />
    </span>
  );
}

function EditableArea({
  value, onSave, className = "", label = "Edit",
}: {
  value: string; onSave: (v: string) => void; className?: string; label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <EditModal
        isOpen={open} label={label} value={value} minHeight={160}
        onSave={v => { onSave(v); setOpen(false); }}
        onCancel={() => setOpen(false)}
      />
      <div
        onClick={() => setOpen(true)}
        className={`cursor-text group/area relative rounded-lg px-3 py-2 border border-transparent hover:border-white/10 hover:bg-white/[0.03] transition-all ${className}`}
      >
        <p className="text-sm text-on-surface-variant leading-relaxed pr-5">{value}</p>
        <Pencil className="absolute top-2 right-2 h-3 w-3 text-on-surface-variant/0 group-hover/area:text-on-surface-variant/40 transition-all" />
      </div>
    </>
  );
}

function EditableBullet({ value, onChange, role }: {
  value: string;
  onChange: (v: string) => void;
  role?: string;
}) {
  const [open, setOpen] = useState(false);
  const isLong = value.length > 250;
  const { prefillJd } = useResumeLabStore();

  return (
    <>
      <EditModal
        isOpen={open} label="Edit bullet" value={value} minHeight={140}
        placeholder="Write a strong action-verb bullet…"
        regenContext={{ jobDescription: prefillJd || undefined, role }}
        onSave={v => { onChange(v); setOpen(false); }}
        onCancel={() => setOpen(false)}
      />
      <div
        className={`flex items-start gap-2 group/bullet rounded-lg px-2 py-1.5 border transition-all
          ${isLong ? "border-amber-500/20 bg-amber-500/5" : "border-white/6 bg-white/[0.02] hover:bg-white/5 hover:border-white/10"}`}
      >
        <span className="text-primary/60 mt-0.5 shrink-0 text-sm">•</span>
        <span className="flex-1 text-sm text-on-surface-variant leading-relaxed cursor-text" onClick={() => setOpen(true)}>{value}</span>
        {/* Always-visible edit button with background */}
        <button
          onClick={e => { e.stopPropagation(); setOpen(true); }}
          className="mt-0.5 shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/8 border border-white/12 text-white/60 hover:bg-primary/20 hover:text-primary hover:border-primary/30 transition-all text-[10px] font-medium"
          title="Edit bullet"
        >
          <Pencil className="h-2.5 w-2.5" /> Edit
        </button>
      </div>
    </>
  );
}

// ─── Layout slider ────────────────────────────────────────────────────────────
function LayoutSlider({
  label, value, min, max, step, format, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-on-surface-variant/60">{label}</span>
        <span className="text-xs font-mono text-on-surface-variant/80">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-primary cursor-pointer"
      />
    </div>
  );
}

// ─── Sortable section row ─────────────────────────────────────────────────────
function SortableSectionRow({
  id, label, visible, isCustom, column, onToggle, onRename, onDelete, onToggleColumn,
}: {
  id: string; label: string; visible: boolean; isCustom: boolean;
  column?: "sidebar" | "main";
  onToggle: () => void; onRename: (name: string) => void; onDelete: () => void;
  onToggleColumn?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(label);

  useEffect(() => { setNameDraft(label); }, [label]);

  function confirmRename() {
    if (nameDraft.trim()) onRename(nameDraft.trim());
    setEditingName(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all select-none
        ${isDragging ? "bg-primary/10 border-primary/30 shadow-lg z-50" : "bg-white/3 border-white/8 hover:bg-white/6"}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-on-surface-variant/30 hover:text-on-surface-variant touch-none">
        <GripVertical className="h-4 w-4" />
      </button>

      {editingName ? (
        <input
          autoFocus
          value={nameDraft}
          onChange={e => setNameDraft(e.target.value)}
          onBlur={confirmRename}
          onKeyDown={e => {
            if (e.key === "Enter") confirmRename();
            if (e.key === "Escape") { setNameDraft(label); setEditingName(false); }
          }}
          className="flex-1 text-sm bg-surface-container-high border border-primary/50 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/40 min-w-0"
        />
      ) : (
        <span
          className="flex-1 text-sm text-on-surface group/lbl flex items-center gap-1 min-w-0 cursor-text"
          onClick={() => setEditingName(true)}
        >
          <span className="truncate">{label}</span>
          <Pencil className="h-2.5 w-2.5 opacity-50 group-hover/lbl:opacity-90 transition-opacity shrink-0" />
        </span>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {column !== undefined && onToggleColumn && (
          <button
            onClick={e => { e.stopPropagation(); onToggleColumn(); }}
            title={column === "sidebar" ? "Sidebar — click to move to main column" : "Main — click to move to sidebar"}
            className={`h-5 w-5 rounded text-[9px] font-bold border transition-all flex items-center justify-center ${
              column === "sidebar"
                ? "bg-primary/15 border-primary/30 text-primary"
                : "bg-white/4 border-white/10 text-on-surface-variant/30 hover:bg-white/8 hover:text-on-surface-variant/60"
            }`}
          >
            {column === "sidebar" ? "L" : "R"}
          </button>
        )}
        <button onClick={onToggle} className={`transition-colors ${visible ? "text-on-surface-variant/40 hover:text-primary" : "text-on-surface-variant/20 hover:text-on-surface-variant"}`}>
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        {isCustom && (
          <button onClick={onDelete} className="text-on-surface-variant/55 hover:text-red-400 transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <p className="text-[10px] font-semibold text-on-surface-variant/50 uppercase tracking-wider">{label}</p>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

// ─── Main Split Editor ────────────────────────────────────────────────────────
export function ResumeSplitEditor() {
  const {
    tailoredContent, tailoringInProgress, selectedContent,
    selectedTemplate, accentColor, fontStyle,
    activeApplicationId, savedResumeId,
    draftContent, editorPrefs,
    setSelectedTemplate, setAccentColor, setFontStyle, setTailoredContent,
    setSavedResumeId, setDraftContent, setEditorPrefs,
  } = useResumeLabStore();

  // Editor prefs — backed by store so they survive Back → re-open
  // On first load (sectionOrder empty), derive from DEFAULT + any custom sections in content
  // Both wrapped in useMemo so they produce stable references between renders.
  // Without this, new Set/array instances every render cause visibleOrder to change every render,
  // which makes the debounce effect fire every render → infinite setPdfSnapshotKey loop.
  const sectionOrder = useMemo(() => {
    if (editorPrefs.sectionOrder.length > 0) return editorPrefs.sectionOrder;
    return [
      ...DEFAULT_SECTION_ORDER,
      ...((draftContent ?? tailoredContent)?.customSections ?? []).map(s => s.id),
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorPrefs.sectionOrder, draftContent, tailoredContent]);

  const hiddenSections = useMemo(
    () => new Set(editorPrefs.hiddenSections),
    [editorPrefs.hiddenSections],
  );
  const layout = editorPrefs.layout;
  const compact = editorPrefs.compact;
  const columnMap = editorPrefs.columnMap;

  function setSectionOrder(updater: string[] | ((prev: string[]) => string[])) {
    const next = typeof updater === "function" ? updater(sectionOrder) : updater;
    setEditorPrefs({ sectionOrder: next });
  }
  function setHiddenSections(updater: Set<string> | ((prev: Set<string>) => Set<string>)) {
    const next = typeof updater === "function" ? updater(hiddenSections) : updater;
    setEditorPrefs({ hiddenSections: [...next] });
  }
  function setLayout(updater: LayoutOverrides | ((prev: LayoutOverrides) => LayoutOverrides)) {
    const next = typeof updater === "function" ? updater(layout) : updater;
    setEditorPrefs({ layout: next });
  }
  function setCompact(updater: boolean | ((prev: boolean) => boolean)) {
    const next = typeof updater === "function" ? updater(compact) : updater;
    setEditorPrefs({ compact: next });
  }
  function setColumnMap(updater: Record<string, "sidebar" | "main"> | ((prev: Record<string, "sidebar" | "main">) => Record<string, "sidebar" | "main">)) {
    const next = typeof updater === "function" ? updater(columnMap) : updater;
    setEditorPrefs({ columnMap: next });
  }

  const { showUpgrade, upgradeReason, openUpgrade, closeUpgrade } = useUpgradePrompt();
  const latestBlobRef = useRef<Blob | null>(null);
  const [blobReady, setBlobReady] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [zoom, setZoom] = useState(1.0);
  // Name for general (unlinked) resumes — shown as editable input in toolbar
  const [generalName, setGeneralName] = useState(
    `General Resume – ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
  );
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setPreviewSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showLayoutControls, setShowLayoutControls] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newGroupSkillInputs, setNewGroupSkillInputs] = useState<Record<number, string>>({});
  const [newGroupName, setNewGroupName] = useState("");
  // draftContent holds unsaved in-editor edits; falls back to tailoredContent
  const content = draftContent ?? tailoredContent;

  const analysis = useMemo(
    () => (content ? analyzeContent(content, selectedTemplate) : null),
    [content, selectedTemplate],
  );

  useEffect(() => {
    // Apply recommended spacing once per resume session; skip if user already customized
    if (analysis && !editorPrefs.layoutAutoApplied) {
      setLayout(prev => ({ ...prev, spacing: analysis.recommendedSpacing }));
      setEditorPrefs({ layoutAutoApplied: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis?.recommendedSpacing, editorPrefs.layoutAutoApplied]);

  const visibleOrder = useMemo(
    () => sectionOrder.filter(id => !hiddenSections.has(id)),
    [sectionOrder, hiddenSections],
  );


  // ── Content mutators ──────────────────────────────────────────────────────
  function patch(updater: (c: TailoredContent) => TailoredContent) {
    setDraftContent(updater(draftContent ?? tailoredContent!));
  }

  function updateBullet(expIdx: number, bIdx: number, val: string) {
    patch(c => ({ ...c, experience: c.experience.map((e, i) => i === expIdx ? { ...e, bullets: e.bullets.map((b, j) => j === bIdx ? val : b) } : e) }));
  }
  function updateExpField(expIdx: number, field: "title" | "company" | "duration", val: string) {
    patch(c => ({ ...c, experience: c.experience.map((e, i) => i === expIdx ? { ...e, [field]: val } : e) }));
  }
  function updateEdu(eduIdx: number, field: "degree" | "institution" | "year", val: string) {
    patch(c => ({ ...c, education: c.education.map((e, i) => i === eduIdx ? { ...e, [field]: val } : e) }));
  }
  function removeSkill(skill: string) {
    patch(c => ({ ...c, skills: c.skills.filter(s => s !== skill) }));
  }
  function addSkill(skill: string) {
    if (!skill.trim()) return;
    patch(c => ({ ...c, skills: [...c.skills, skill.trim()] }));
  }
  function applyAutoGroup() {
    patch(c => {
      const groups = autoGroupSkills(flattenSkills(c));
      return { ...c, skillGroups: groups, skills: groups.flatMap(g => g.items) };
    });
  }
  function addSkillToGroup(gIdx: number, skill: string) {
    if (!skill.trim()) return;
    patch(c => {
      const groups = (c.skillGroups ?? []).map((g, i) =>
        i === gIdx ? { ...g, items: [...g.items, skill.trim()] } : g,
      );
      return { ...c, skillGroups: groups, skills: groups.flatMap(g => g.items) };
    });
  }
  function removeSkillFromGroup(gIdx: number, skill: string) {
    patch(c => {
      const groups = (c.skillGroups ?? []).map((g, i) =>
        i === gIdx ? { ...g, items: g.items.filter(s => s !== skill) } : g,
      );
      return { ...c, skillGroups: groups, skills: groups.flatMap(g => g.items) };
    });
  }
  function renameSkillGroup(gIdx: number, label: string) {
    patch(c => {
      const groups = (c.skillGroups ?? []).map((g, i) =>
        i === gIdx ? { ...g, label } : g,
      );
      return { ...c, skillGroups: groups };
    });
  }
  function removeSkillGroup(gIdx: number) {
    patch(c => {
      const groups = (c.skillGroups ?? []).filter((_, i) => i !== gIdx);
      return { ...c, skillGroups: groups, skills: groups.flatMap(g => g.items) };
    });
  }
  function addSkillGroup(label: string) {
    if (!label.trim()) return;
    patch(c => {
      const groups = [...(c.skillGroups ?? autoGroupSkills(c.skills)), { label: label.trim(), items: [] }];
      return { ...c, skillGroups: groups };
    });
  }
  function updateSummary(val: string) {
    patch(c => ({ ...c, summary: val }));
  }
  function updateName(val: string) {
    patch(c => ({ ...c, name: val }));
  }
  function updateContact(field: keyof TailoredContent["contact"], val: string) {
    patch(c => ({ ...c, contact: { ...c.contact, [field]: val } }));
  }
  function addExperience() {
    patch(c => ({
      ...c,
      experience: [...c.experience, { title: "", company: "", duration: "", bullets: [""] }],
    }));
  }
  function deleteExperience(idx: number) {
    patch(c => ({ ...c, experience: c.experience.filter((_, i) => i !== idx) }));
  }
  function addExpBullet(expIdx: number) {
    patch(c => ({
      ...c,
      experience: c.experience.map((e, i) => i === expIdx ? { ...e, bullets: [...e.bullets, ""] } : e),
    }));
  }
  function deleteExpBullet(expIdx: number, bIdx: number) {
    patch(c => ({
      ...c,
      experience: c.experience.map((e, i) => i === expIdx ? { ...e, bullets: e.bullets.filter((_, j) => j !== bIdx) } : e),
    }));
  }
  function addEducation() {
    patch(c => ({ ...c, education: [...c.education, { degree: "", institution: "", year: "" }] }));
  }
  function deleteEducation(idx: number) {
    patch(c => ({ ...c, education: c.education.filter((_, i) => i !== idx) }));
  }

  // ── Section name / custom section mutators ────────────────────────────────
  function renameSectionLabel(id: string, name: string) {
    if (id.startsWith("custom_")) {
      patch(c => ({
        ...c,
        customSections: (c.customSections ?? []).map(s => s.id === id ? { ...s, label: name } : s),
      }));
    } else {
      patch(c => ({ ...c, sectionNames: { ...(c.sectionNames ?? {}), [id]: name } }));
    }
  }

  function addCustomSection(name: string) {
    const id = `custom_${Date.now()}`;
    const newSection: CustomSection = { id, label: name, items: [] };
    patch(c => ({ ...c, customSections: [...(c.customSections ?? []), newSection] }));
    setSectionOrder(prev => [...prev, id]);
  }

  function deleteCustomSection(id: string) {
    patch(c => ({ ...c, customSections: (c.customSections ?? []).filter(s => s.id !== id) }));
    setSectionOrder(prev => prev.filter(sid => sid !== id));
    setHiddenSections(prev => { const next = new Set(prev); next.delete(id); return next; });
  }

  function addCustomSectionItem(sectionId: string) {
    patch(c => ({
      ...c,
      customSections: (c.customSections ?? []).map(s =>
        s.id === sectionId ? { ...s, items: [...s.items, { title: "", subtitle: "", bullets: [] }] } : s,
      ),
    }));
  }

  function updateCustomItem(sectionId: string, itemIdx: number, field: "title" | "subtitle", val: string) {
    patch(c => ({
      ...c,
      customSections: (c.customSections ?? []).map(s =>
        s.id === sectionId
          ? { ...s, items: s.items.map((item, i) => i === itemIdx ? { ...item, [field]: val } : item) }
          : s,
      ),
    }));
  }

  function deleteCustomSectionItem(sectionId: string, itemIdx: number) {
    patch(c => ({
      ...c,
      customSections: (c.customSections ?? []).map(s =>
        s.id === sectionId ? { ...s, items: s.items.filter((_, i) => i !== itemIdx) } : s,
      ),
    }));
  }

  function addCustomBullet(sectionId: string, itemIdx: number) {
    patch(c => ({
      ...c,
      customSections: (c.customSections ?? []).map(s =>
        s.id === sectionId
          ? { ...s, items: s.items.map((item, i) => i === itemIdx ? { ...item, bullets: [...item.bullets, ""] } : item) }
          : s,
      ),
    }));
  }

  function updateCustomBullet(sectionId: string, itemIdx: number, bIdx: number, val: string) {
    patch(c => ({
      ...c,
      customSections: (c.customSections ?? []).map(s =>
        s.id === sectionId
          ? {
              ...s,
              items: s.items.map((item, i) =>
                i === itemIdx ? { ...item, bullets: item.bullets.map((b, j) => j === bIdx ? val : b) } : item,
              ),
            }
          : s,
      ),
    }));
  }

  function deleteCustomBullet(sectionId: string, itemIdx: number, bIdx: number) {
    patch(c => ({
      ...c,
      customSections: (c.customSections ?? []).map(s =>
        s.id === sectionId
          ? {
              ...s,
              items: s.items.map((item, i) =>
                i === itemIdx ? { ...item, bullets: item.bullets.filter((_, j) => j !== bIdx) } : item,
              ),
            }
          : s,
      ),
    }));
  }

  // ── Column assignment (Modern only) ──────────────────────────────────────
  function getSectionColumn(id: string): "sidebar" | "main" {
    return columnMap[id] ?? ((id === "education" || id === "skills") ? "sidebar" : "main");
  }
  function toggleSectionColumn(id: string) {
    const next = getSectionColumn(id) === "sidebar" ? "main" : "sidebar";
    setColumnMap(prev => ({ ...prev, [id]: next }));
  }

  async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ── Save to DB ────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!content) return;
    setSaveState("saving");
    try {
      const tailored_content = content as unknown as Record<string, unknown>;
      let resumeId = savedResumeId;

      let pdf_bytes: string | undefined;
      if (latestBlobRef.current) {
        try { pdf_bytes = await blobToBase64(latestBlobRef.current); } catch { /* non-fatal */ }
      }

      if (savedResumeId) {
        // Updating an already-saved resume
        await api.resumes.update(savedResumeId, { tailored_content, pdf_bytes });
      } else if (activeApplicationId) {
        // Linked to a tracked job
        const saved = await api.resumes.saveTailored({ application_id: activeApplicationId, tailored_content, pdf_bytes });
        resumeId = saved.id;
        setSavedResumeId(saved.id);
      } else {
        // General resume — first save, no job link
        const saved = await api.resumes.saveTailored({
          application_id: null,
          name: generalName.trim() || `General Resume – ${new Date().toLocaleDateString()}`,
          tailored_content,
          pdf_bytes,
        });
        resumeId = saved.id;
        setSavedResumeId(saved.id);
      }

      setSaveState("saved");

      // General resumes (no job link) always redirect back to Resume Lab after saving
      if (!activeApplicationId) {
        setTimeout(() => setTailoredContent(null), 1200);
        return;
      }

      // If opened from a job card (has application link), notify + redirect back
      if (activeApplicationId && resumeId) {
        try {
          const app = await api.applications.get(activeApplicationId);
          window.dispatchEvent(new CustomEvent("af_resume_saved", {
            detail: {
              resumeId,
              applicationId: activeApplicationId,
              company: app.company,
              role: app.role,
              jobUrl: app.job_url ?? null,
            },
          }));
          if (app.job_url) {
            // Small delay so the content script can write to storage before we navigate
            await new Promise(r => setTimeout(r, 300));
            window.location.href = app.job_url;
            return;
          }
        } catch {
          // Non-fatal — fall through to normal saved state
        }
      }

      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 402) {
        setSaveState("idle");
        openUpgrade("You've used all 5 free resume tailors this month. Upgrade to Pro for unlimited tailoring.");
      } else {
        setSaveState("error");
        setTimeout(() => setSaveState("idle"), 3000);
      }
    }
  }

  // ── DnD ──────────────────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSectionOrder(prev => arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string)));
    }
  }

  const overflows = (analysis?.estimatedPages ?? 0) > 1.05;

  // Show loading screen immediately when tailoring starts — user doesn't wait on the upload page
  if (tailoringInProgress && !content) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-[#0d0d0d] text-white/60" style={{ zIndex: 10 }}>
        <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-primary animate-pulse" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-white/80">AI is tailoring your resume…</p>
          <p className="text-xs text-white/40">Analysing job description · Rewriting bullets · Optimising for ATS</p>
        </div>
        <div className="flex gap-1.5">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="h-1 w-8 rounded-full bg-primary/20 overflow-hidden">
              <div className="h-full bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!content) return null;

  const customSections = content.customSections ?? [];

  return (
    <>
    <UpgradeModal open={showUpgrade} onClose={closeUpgrade} reason={upgradeReason} />
    <div className="-m-6 flex h-[calc(100vh-3.5rem)] overflow-hidden">

      {/* ── Left: PDF Preview ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 bg-[#141414] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0d0d0d] border-b border-white/8 shrink-0">
          <button
            onClick={() => { setTailoredContent(null); }}
            className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/80 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-medium text-white/70">Resume Editor</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center gap-0.5 border border-white/15 rounded-lg overflow-hidden">
              <button
                onClick={() => setZoom(z => Math.max(1.0, +(z - 0.1).toFixed(1)))}
                className="h-8 w-7 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/8 transition-colors text-sm font-bold disabled:opacity-30"
                title="Zoom out"
                disabled={zoom <= 1.0}
              >−</button>
              <button
                onClick={() => setZoom(1.0)}
                className="h-8 px-2 text-[11px] font-medium text-white/50 hover:text-white hover:bg-white/8 transition-colors tabular-nums min-w-[44px] text-center"
                title="Reset zoom"
              >{Math.round(zoom * 100)}%</button>
              <button
                onClick={() => setZoom(z => Math.min(2.0, +(z + 0.1).toFixed(1)))}
                className="h-8 w-7 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/8 transition-colors text-sm font-bold"
                title="Zoom in"
              >+</button>
            </div>

            {(overflows || compact) && (
              <button
                onClick={() => setCompact(v => !v)}
                className={`h-8 px-3 rounded-lg border text-xs font-medium transition-all
                  ${compact
                    ? "border-primary/50 bg-primary/12 text-primary"
                    : "border-white/20 text-white/60 hover:bg-white/5"}`}>
                {compact ? "Compact on" : "Fit to 1 page"}
              </button>
            )}
            {/* Name input for general (unlinked) resumes */}
            {!activeApplicationId && !savedResumeId && (
              <input
                value={generalName}
                onChange={e => setGeneralName(e.target.value)}
                placeholder="Resume name…"
                className="h-8 px-3 rounded-lg text-xs bg-white/5 border border-white/12 text-white/70 placeholder:text-white/30 focus:outline-none focus:border-primary/40 w-44"
                title="Name for this general resume"
              />
            )}
            <button
              onClick={() => void handleSave()}
              disabled={saveState === "saving"}
              className={`h-8 px-4 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 border
                ${saveState === "saved"
                  ? "bg-green-500/15 border-green-500/30 text-green-400"
                  : saveState === "error"
                  ? "bg-error/15 border-error/30 text-error"
                  : "bg-primary/15 border-primary/30 text-primary hover:bg-primary/25"}`}
            >
              {saveState === "saving"
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                : saveState === "saved"
                ? <><Check className="h-3.5 w-3.5" /> Saved</>
                : saveState === "error"
                ? "Save failed — retry"
                : <><Save className="h-3.5 w-3.5" /> Save</>
              }
            </button>
          </div>
        </div>

        {/*
          Three zoom scenarios for an iframe-based PDF viewer:

          zoom > 1 (zoom in): spacer = zoom×naturalSize creates scroll area;
                              iframe at natural size, scaled from top-left.

          zoom < 1 (zoom out): iframe at natural size, scaled from top-center
                               so it appears centered with space around it.
                               No scrollbars — content is smaller than viewport.

          zoom = 1 (100%): original w-full h-full layout, no transform.
        */}
        <div
          ref={previewContainerRef}
          className="flex-1 min-h-0"
          style={{ overflow: zoom > 1 ? "auto" : "hidden", scrollbarWidth: "thin", position: "relative" }}
        >
          {/* Fallback / zoom=1: fill container normally */}
          {(previewSize.w === 0 || zoom === 1) && (
            <div className="w-full h-full">
              <PdfViewer
                templateId={selectedTemplate} accentColor={accentColor} fontStyle={fontStyle}
                compact={compact} layout={layout} sectionOrder={visibleOrder}
                columnMap={selectedTemplate === "modern" ? columnMap : undefined}
                content={content} onBlobReady={(blob) => { latestBlobRef.current = blob; setBlobReady(true); }}
              />
            </div>
          )}

          {/* Zoom IN (>100%): layout spacer creates scroll area */}
          {zoom > 1 && previewSize.w > 0 && (
            <div style={{ width: previewSize.w * zoom, height: previewSize.h * zoom, position: "relative", flexShrink: 0 }}>
              <div style={{
                position: "absolute", top: 0, left: 0,
                width: previewSize.w, height: previewSize.h,
                transform: `scale(${zoom})`, transformOrigin: "top left",
              }}>
                <PdfViewer
                  templateId={selectedTemplate} accentColor={accentColor} fontStyle={fontStyle}
                  compact={compact} layout={layout} sectionOrder={visibleOrder}
                  columnMap={selectedTemplate === "modern" ? columnMap : undefined}
                  content={content} onBlobReady={(blob) => { latestBlobRef.current = blob; setBlobReady(true); }}
                />
              </div>
            </div>
          )}

          {/* zoom < 1 is now disabled (min = 1.0), so no zoom-out branch needed */}
        </div>

        {analysis && (
          <div className="shrink-0 px-4 py-2 bg-[#0d0d0d] border-t border-white/8 flex items-center gap-5 text-xs">
            <div className="flex items-center gap-1.5">
              {analysis.longBulletCount === 0 ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <AlertTriangle className="h-3 w-3 text-amber-400" />}
              <span className="text-white/40">{analysis.longBulletCount === 0 ? "Bullets OK" : `${analysis.longBulletCount} long`}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {!overflows ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <AlertTriangle className="h-3 w-3 text-amber-400" />}
              <span className="text-white/40">{!overflows ? "Est. 1 page" : `Est. ~${analysis.estimatedPages.toFixed(1)} pages`}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/30">ATS</span>
              {content.ats_score_before != null && (
                <>
                  <span className="text-white/30 line-through text-[10px]">{content.ats_score_before}</span>
                  <span className="text-white/20">→</span>
                </>
              )}
              <span className="font-semibold" style={{ color: content.ats_score >= 80 ? "#22c55e" : content.ats_score >= 60 ? "#f59e0b" : "#ef4444" }}>
                {content.ats_score}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-white/30">Spacing {layout.spacing.toFixed(1)}×</span>
              <span className="text-white/20">·</span>
              <span className="text-white/30">Margins {layout.margins.toFixed(1)}×</span>
              {layout.fontDelta !== 0 && <><span className="text-white/20">·</span><span className="text-white/30">Font {layout.fontDelta > 0 ? "+" : ""}{layout.fontDelta}pt</span></>}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Edit Sidebar ───────────────────────────────────────────── */}
      <div className="w-[352px] shrink-0 border-l border-white/8 flex flex-col bg-surface overflow-hidden">
        <div className="flex-1 overflow-y-auto">

          {/* ── Template ─────────────────────────────────────────────────── */}
          <div className="px-4 pt-4 pb-3 border-b border-white/5">
            <SectionHeader label="Template" />
            <div className="grid grid-cols-5 gap-1">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
                  className={`py-1.5 rounded-lg text-[10px] font-medium border transition-all
                    ${selectedTemplate === t.id ? "border-primary bg-primary/12 text-primary" : "border-white/8 text-on-surface-variant/50 hover:border-white/20 hover:bg-white/5"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Style ────────────────────────────────────────────────────── */}
          <div className="px-4 py-3 border-b border-white/5">
            <SectionHeader label="Style" />
            <div className="flex items-center gap-6">
              <div>
                <p className="text-[10px] text-on-surface-variant/40 mb-1.5">Colour</p>
                <div className="flex gap-1.5">
                  {ACCENT_COLORS.map(c => (
                    <button key={c.hex} onClick={() => setAccentColor(c.hex)} title={c.label}
                      className={`h-5 w-5 rounded-full border-2 transition-all ${accentColor === c.hex ? "border-white scale-110 shadow" : "border-transparent hover:scale-110"}`}
                      style={{ backgroundColor: c.hex }} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-on-surface-variant/40 mb-1.5">Font</p>
                <div className="flex gap-1">
                  {(["sans", "serif"] as FontStyle[]).map(f => (
                    <button key={f} onClick={() => setFontStyle(f)}
                      className={`h-7 px-3 rounded-md text-xs font-medium border transition-all
                        ${fontStyle === f ? "bg-primary/15 border-primary/40 text-primary" : "bg-white/3 border-white/10 text-on-surface-variant/60 hover:bg-white/8"}`}>
                      {f === "sans" ? "Sans" : "Serif"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Layout controls ───────────────────────────────────────────── */}
          <div className="px-4 py-3 border-b border-white/5">
            <button onClick={() => setShowLayoutControls(v => !v)} className="flex items-center gap-2 w-full group">
              <SlidersHorizontal className="h-3 w-3 text-on-surface-variant/40" />
              <p className="text-[10px] font-semibold text-on-surface-variant/50 uppercase tracking-wider flex-1 text-left">Layout</p>
              {showLayoutControls ? <ChevronUp className="h-3 w-3 text-on-surface-variant/30" /> : <ChevronDown className="h-3 w-3 text-on-surface-variant/30" />}
            </button>
            {showLayoutControls && (
              <div className="mt-3 space-y-3.5">
                {compact && (
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="text-amber-400 text-xs">⚠</span>
                    <p className="text-[10px] text-amber-300/80 leading-snug">
                      Layout controls are disabled in Compact mode. Click <strong>Compact on</strong> in the toolbar to re-enable them.
                    </p>
                  </div>
                )}
                <div className={compact ? "opacity-40 pointer-events-none" : ""}>
                <LayoutSlider label="Spacing" value={layout.spacing} min={0.7} max={2.5} step={0.05}
                  format={v => `${v.toFixed(2)}×`} onChange={v => setLayout(prev => ({ ...prev, spacing: v }))} />
                <LayoutSlider label="Margins" value={layout.margins} min={0.6} max={1.4} step={0.05}
                  format={v => `${v.toFixed(2)}×`} onChange={v => setLayout(prev => ({ ...prev, margins: v }))} />
                <LayoutSlider label="Font size" value={layout.fontDelta} min={-2} max={2} step={0.5}
                  format={v => `${v > 0 ? "+" : ""}${v}pt`} onChange={v => setLayout(prev => ({ ...prev, fontDelta: v }))} />
                {selectedTemplate === "modern" && (
                  <LayoutSlider label="Sidebar width" value={layout.sidebarWidth} min={130} max={200} step={5}
                    format={v => `${v}pt`} onChange={v => setLayout(prev => ({ ...prev, sidebarWidth: v }))} />
                )}
                <button onClick={() => { setLayout({ spacing: analysis?.recommendedSpacing ?? 1, margins: 1, fontDelta: 0, sidebarWidth: 162 }); }}
                  className="text-[10px] text-on-surface-variant/30 hover:text-on-surface-variant/60 transition-colors">
                  Reset to auto
                </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Sections ─────────────────────────────────────────────────── */}
          <div className="px-4 py-3 border-b border-white/5">
            <SectionHeader label="Sections" />
            <p className="text-[10px] text-on-surface-variant/30 mb-2">
              Drag to reorder · click name to rename · eye to hide
              {selectedTemplate === "modern" && <span className="ml-1 text-primary/50">· L/R = sidebar / main</span>}
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {sectionOrder.map(id => (
                    <SortableSectionRow
                      key={id}
                      id={id}
                      label={getSectionLabel(id, content)}
                      visible={!hiddenSections.has(id)}
                      isCustom={id.startsWith("custom_")}
                      column={selectedTemplate === "modern" ? getSectionColumn(id) : undefined}
                      onToggle={() => setHiddenSections(prev => {
                        const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
                      })}
                      onRename={name => renameSectionLabel(id, name)}
                      onDelete={() => deleteCustomSection(id)}
                      onToggleColumn={selectedTemplate === "modern" ? () => toggleSectionColumn(id) : undefined}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add Section */}
            {isAddingSection ? (
              <div className="flex gap-1.5 mt-1.5">
                <input
                  autoFocus
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newSectionName.trim()) {
                      addCustomSection(newSectionName.trim());
                      setNewSectionName(""); setIsAddingSection(false);
                    }
                    if (e.key === "Escape") { setNewSectionName(""); setIsAddingSection(false); }
                  }}
                  placeholder="Section name…"
                  className="flex-1 h-7 px-2 rounded-md bg-white/5 border border-white/10 text-xs text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50"
                />
                <button
                  onClick={() => {
                    if (newSectionName.trim()) {
                      addCustomSection(newSectionName.trim());
                      setNewSectionName(""); setIsAddingSection(false);
                    }
                  }}
                  className="h-7 w-7 rounded-md bg-primary/10 border border-primary/20 text-primary flex items-center justify-center hover:bg-primary/20 transition-all">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => { setNewSectionName(""); setIsAddingSection(false); }}
                  className="h-7 w-7 rounded-md bg-white/5 border border-white/10 text-on-surface-variant/50 flex items-center justify-center hover:bg-white/10 transition-all">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingSection(true)}
                className="mt-1.5 w-full py-1.5 rounded-lg border border-dashed border-white/10 text-[10px] text-on-surface-variant/30 hover:border-white/20 hover:text-on-surface-variant/50 transition-all flex items-center justify-center gap-1">
                <Plus className="h-3 w-3" /> Add section
              </button>
            )}
          </div>

          {/* ── Content editing ───────────────────────────────────────────── */}
          <div className="px-4 py-3 space-y-5">
            <SectionHeader label="Edit Content" />

            {/* Name + contact */}
            <div className="space-y-1 p-3 rounded-xl bg-white/3 border border-white/6 hover:border-white/10 transition-colors">
              <EditableField value={content.name} onSave={updateName}
                className="text-sm font-bold text-on-surface" />
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
                {(["email", "phone", "location", "linkedin", "github", "website"] as const).map(field => (
                  <EditableField key={field} value={content.contact[field] ?? ""} placeholder={field}
                    onSave={v => updateContact(field, v)}
                    className="text-xs text-on-surface-variant/60 truncate min-w-0" />
                ))}
              </div>
            </div>

            {/* Summary */}
            {content.summary !== undefined && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-wider px-1">
                  {getSectionLabel("summary", content)}
                </p>
                <EditableArea value={content.summary} onSave={updateSummary} />
              </div>
            )}

            {/* Experience */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <p className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-wider flex-1">
                  {getSectionLabel("experience", content)}
                </p>
                <button onClick={addExperience}
                  className="h-5 px-1.5 rounded bg-white/5 border border-white/10 text-[10px] text-on-surface-variant/50 hover:bg-white/10 flex items-center gap-0.5 shrink-0">
                  <Plus className="h-2.5 w-2.5" /> Add
                </button>
              </div>
              {content.experience.map((exp, i) => (
                <div key={i} className="space-y-1.5 p-3 rounded-xl bg-white/3 border border-white/6 hover:border-white/10 transition-colors">
                  <div className="flex items-start gap-2">
                    <EditableField value={exp.title} onSave={v => updateExpField(i, "title", v)}
                      className="text-sm font-semibold text-on-surface flex-1 min-w-0" />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <EditableField value={exp.duration} onSave={v => updateExpField(i, "duration", v)}
                        className="text-xs text-on-surface-variant/50" />
                      <button onClick={() => deleteExperience(i)}
                        className="text-on-surface-variant/60 hover:text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <EditableField value={exp.company} onSave={v => updateExpField(i, "company", v)}
                    className="text-xs text-on-surface-variant/60" />
                  <div className="mt-1 rounded-lg border border-white/5 overflow-hidden">
                    {exp.bullets.map((b, j) => (
                      <div key={j} className="flex items-start gap-1">
                        <div className="flex-1 min-w-0">
                          <EditableBullet value={b} onChange={v => updateBullet(i, j, v)} role={`${exp.title} at ${exp.company}`} />
                        </div>
                        <button onClick={() => deleteExpBullet(i, j)}
                          className="mt-1.5 mr-0.5 shrink-0 h-5 w-5 flex items-center justify-center rounded bg-white/8 border border-white/12 text-white/50 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all"
                          title="Delete bullet">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addExpBullet(i)}
                    className="text-[10px] text-white/55 hover:text-white/90 flex items-center gap-1 transition-colors px-1 py-0.5 rounded hover:bg-white/5">
                    <Plus className="h-2.5 w-2.5" /> Add bullet
                  </button>
                </div>
              ))}
              {content.experience.length === 0 && (
                <button onClick={addExperience}
                  className="w-full py-3 rounded-xl border border-dashed border-white/10 text-xs text-on-surface-variant/30 hover:border-white/20 hover:text-on-surface-variant/50 transition-all flex items-center justify-center gap-1">
                  <Plus className="h-3 w-3" /> Add experience
                </button>
              )}
            </div>

            {/* Education */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <p className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-wider flex-1">
                  {getSectionLabel("education", content)}
                </p>
                <button onClick={addEducation}
                  className="h-5 px-1.5 rounded bg-white/5 border border-white/10 text-[10px] text-on-surface-variant/50 hover:bg-white/10 flex items-center gap-0.5 shrink-0">
                  <Plus className="h-2.5 w-2.5" /> Add
                </button>
              </div>
              {content.education.map((edu, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/3 border border-white/6 hover:border-white/10 transition-colors space-y-0.5">
                  <div className="flex items-start gap-2">
                    <EditableField value={edu.degree} onSave={v => updateEdu(i, "degree", v)}
                      className="text-sm font-medium text-on-surface flex-1 min-w-0" />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <EditableField value={edu.year} onSave={v => updateEdu(i, "year", v)}
                        className="text-xs text-on-surface-variant/50" />
                      <button onClick={() => deleteEducation(i)}
                        className="text-on-surface-variant/55 hover:text-red-400 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <EditableField value={edu.institution} onSave={v => updateEdu(i, "institution", v)}
                    className="text-xs text-on-surface-variant/60" />
                </div>
              ))}
              {content.education.length === 0 && (
                <button onClick={addEducation}
                  className="w-full py-3 rounded-xl border border-dashed border-white/10 text-xs text-on-surface-variant/30 hover:border-white/20 hover:text-on-surface-variant/50 transition-all flex items-center justify-center gap-1">
                  <Plus className="h-3 w-3" /> Add education
                </button>
              )}
            </div>

            {/* Skills */}
            {flattenSkills(content).length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <p className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-wider flex-1">
                    {getSectionLabel("skills", content)}
                  </p>
                  <button
                    onClick={applyAutoGroup}
                    title="Automatically group skills by category"
                    className="h-5 px-1.5 rounded bg-white/5 border border-white/10 text-[10px] text-on-surface-variant/50 hover:bg-white/10 flex items-center gap-0.5 shrink-0">
                    <Sparkles className="h-2.5 w-2.5" /> Auto-group
                  </button>
                </div>

                {content.skillGroups ? (
                  <div className="space-y-2">
                    {content.skillGroups.map((grp, gi) => (
                      <div key={gi} className="p-2.5 rounded-xl bg-white/3 border border-white/6 hover:border-white/10 transition-colors space-y-2">
                        <div className="flex items-center gap-1.5">
                          <EditableField
                            value={grp.label}
                            onSave={label => renameSkillGroup(gi, label)}
                            placeholder="Group name"
                            className="flex-1 text-[11px] font-semibold text-on-surface-variant/70"
                          />
                          <button onClick={() => removeSkillGroup(gi)}
                            className="text-on-surface-variant/55 hover:text-red-400 transition-colors shrink-0">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {grp.items.map(skill => (
                            <span key={skill}
                              className="group/skill flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-white/5 border border-white/10 text-xs text-on-surface-variant hover:border-white/20 transition-all">
                              {skill}
                              <button onClick={() => removeSkillFromGroup(gi, skill)}
                                className="h-3.5 w-3.5 rounded flex items-center justify-center text-on-surface-variant/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            value={newGroupSkillInputs[gi] ?? ""}
                            onChange={e => setNewGroupSkillInputs(prev => ({ ...prev, [gi]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                addSkillToGroup(gi, newGroupSkillInputs[gi] ?? "");
                                setNewGroupSkillInputs(prev => ({ ...prev, [gi]: "" }));
                              }
                            }}
                            placeholder="Add skill…"
                            className="flex-1 h-6 px-2 rounded-md bg-white/5 border border-white/10 text-xs text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50"
                          />
                          <button onClick={() => {
                            addSkillToGroup(gi, newGroupSkillInputs[gi] ?? "");
                            setNewGroupSkillInputs(prev => ({ ...prev, [gi]: "" }));
                          }}
                            className="h-6 w-6 rounded-md bg-primary/10 border border-primary/20 text-primary flex items-center justify-center hover:bg-primary/20 transition-all">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-1.5">
                      <input
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { addSkillGroup(newGroupName); setNewGroupName(""); } }}
                        placeholder="New group name…"
                        className="flex-1 h-7 px-2 rounded-md bg-white/5 border border-dashed border-white/10 text-xs text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50"
                      />
                      <button onClick={() => { addSkillGroup(newGroupName); setNewGroupName(""); }}
                        className="h-7 w-7 rounded-md bg-primary/10 border border-primary/20 text-primary flex items-center justify-center hover:bg-primary/20 transition-all">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white/3 border border-white/6 hover:border-white/10 transition-colors">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {content.skills.map(skill => (
                        <span key={skill}
                          className="group/skill flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-white/5 border border-white/10 text-xs text-on-surface-variant hover:border-white/20 transition-all">
                          {skill}
                          <button onClick={() => removeSkill(skill)}
                            className="h-3.5 w-3.5 rounded flex items-center justify-center text-on-surface-variant/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        value={newSkill}
                        onChange={e => setNewSkill(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { addSkill(newSkill); setNewSkill(""); } }}
                        placeholder="Add skill…"
                        className="flex-1 h-7 px-2 rounded-md bg-white/5 border border-white/10 text-xs text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50"
                      />
                      <button onClick={() => { addSkill(newSkill); setNewSkill(""); }}
                        className="h-7 w-7 rounded-md bg-primary/10 border border-primary/20 text-primary flex items-center justify-center hover:bg-primary/20 transition-all">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Custom sections */}
            {customSections.filter(s => sectionOrder.includes(s.id)).map(section => (
              <div key={section.id} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <p className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-wider flex-1 truncate">
                    {getSectionLabel(section.id, content)}
                  </p>
                  <button
                    onClick={() => addCustomSectionItem(section.id)}
                    className="h-5 px-1.5 rounded bg-white/5 border border-white/10 text-[10px] text-on-surface-variant/50 hover:bg-white/10 flex items-center gap-0.5 shrink-0">
                    <Plus className="h-2.5 w-2.5" /> Add item
                  </button>
                </div>

                {section.items.length === 0 ? (
                  <button
                    onClick={() => addCustomSectionItem(section.id)}
                    className="w-full py-3 rounded-xl border border-dashed border-white/10 text-xs text-on-surface-variant/30 hover:border-white/20 hover:text-on-surface-variant/50 transition-all flex items-center justify-center gap-1">
                    <Plus className="h-3 w-3" /> Add first item
                  </button>
                ) : (
                  section.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="p-3 rounded-xl bg-white/3 border border-white/6 hover:border-white/10 transition-colors space-y-1.5">
                      <div className="flex items-start gap-2">
                        <EditableField
                          value={item.title}
                          placeholder="Item title"
                          onSave={v => updateCustomItem(section.id, itemIdx, "title", v)}
                          className="text-sm font-medium text-on-surface flex-1 min-w-0"
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <EditableField
                            value={item.subtitle ?? ""}
                            placeholder="date / subtitle"
                            onSave={v => updateCustomItem(section.id, itemIdx, "subtitle", v)}
                            className="text-xs text-on-surface-variant/50"
                          />
                          <button
                            onClick={() => deleteCustomSectionItem(section.id, itemIdx)}
                            className="text-on-surface-variant/55 hover:text-red-400 transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {item.bullets.length > 0 && (
                        <div className="rounded-lg border border-white/5 overflow-hidden">
                          {item.bullets.map((b, bIdx) => (
                            <div key={bIdx} className="group/brow flex items-start">
                              <div className="flex-1 min-w-0">
                                <EditableBullet value={b} onChange={v => updateCustomBullet(section.id, itemIdx, bIdx, v)} />
                              </div>
                              <button
                                onClick={() => deleteCustomBullet(section.id, itemIdx, bIdx)}
                                className="mt-2 mr-1.5 opacity-0 group-hover/brow:opacity-100 text-on-surface-variant/30 hover:text-red-400 transition-all shrink-0">
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => addCustomBullet(section.id, itemIdx)}
                        className="text-[10px] text-on-surface-variant/60 hover:text-on-surface-variant/90 flex items-center gap-1 transition-colors">
                        <Plus className="h-2.5 w-2.5" /> Add bullet
                      </button>
                    </div>
                  ))
                )}
              </div>
            ))}

            {/* Keywords injected */}
            {content.keywords_added.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-wider px-1">Keywords Injected</p>
                <div className="flex flex-wrap gap-1.5">
                  {content.keywords_added.map(kw => (
                    <span key={kw} className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] text-primary font-medium">{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Keyword stuffing flags — phrases ApplyFlow AI flagged as potentially unnatural */}
            {(content.keyword_stuffing_flags?.length ?? 0) > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-amber-400/70 uppercase tracking-wider px-1 flex items-center gap-1">
                  ⚠ Review These Phrases
                </p>
                <p className="text-[10px] text-on-surface-variant/40 px-1">ApplyFlow AI flagged these as possibly forced — review before sending.</p>
                <div className="flex flex-wrap gap-1.5">
                  {content.keyword_stuffing_flags!.map(flag => (
                    <span key={flag} className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[10px] text-amber-400 font-medium">{flag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Original */}
            <div>
              <button onClick={() => setShowOriginal(v => !v)}
                className="flex items-center gap-1.5 text-xs text-on-surface-variant/30 hover:text-on-surface-variant/60 transition-colors">
                {showOriginal ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showOriginal ? "Hide" : "Show"} original resume
              </button>
              {showOriginal && selectedContent && (
                <div className="mt-2 p-3 rounded-lg bg-surface-container border border-white/5 text-xs text-on-surface-variant/50 whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {selectedContent}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
