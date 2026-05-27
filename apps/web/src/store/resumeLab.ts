import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CustomSectionItem {
  title: string;
  subtitle?: string;
  bullets: string[];
}

export interface CustomSection {
  id: string;      // "custom_<nanoid>"
  label: string;   // user-defined: "Projects", "Certifications", etc.
  items: CustomSectionItem[];
}

export interface SkillGroup {
  label: string;
  items: string[];
}

export interface TailoredContent {
  name: string;
  contact: { email?: string; phone?: string; location?: string; linkedin?: string; github?: string; website?: string };
  summary: string;
  experience: { company: string; title: string; duration: string; bullets: string[] }[];
  education: { institution: string; degree: string; year: string }[];
  skills: string[];           // flat list — kept for backward compat
  skillGroups?: SkillGroup[]; // grouped — takes precedence when present
  keywords_added: string[];
  ats_score: number;
  // Section display name overrides (e.g. experience → "Work History")
  sectionNames?: Record<string, string>;
  // User-added custom sections
  customSections?: CustomSection[];
}

export type TemplateId = "classic" | "modern" | "minimal" | "ats" | "executive";
export type FontStyle = "sans" | "serif";

export interface LayoutOverrides {
  spacing: number;
  margins: number;
  fontDelta: number;
  sidebarWidth: number;
}

export interface EditorPrefs {
  sectionOrder: string[];
  hiddenSections: string[];
  layout: LayoutOverrides;
  compact: boolean;
  columnMap: Record<string, "sidebar" | "main">;
  layoutAutoApplied: boolean;
}

const DEFAULT_EDITOR_PREFS: EditorPrefs = {
  sectionOrder: [],
  hiddenSections: [],
  layout: { spacing: 1.0, margins: 1.0, fontDelta: 0, sidebarWidth: 162 },
  compact: false,
  columnMap: { education: "sidebar", skills: "sidebar" },
  layoutAutoApplied: false,
};

interface ResumeLabState {
  selectedResumeId: string;
  selectedContent: string;
  selectedFilename: string;
  prefillJd: string;
  prefillCompany: string;
  prefillRole: string;
  selectedTemplate: TemplateId;
  accentColor: string;
  fontStyle: FontStyle;
  tailoredContent: TailoredContent | null;
  draftContent: TailoredContent | null;
  editorPrefs: EditorPrefs;
  activeApplicationId: string;
  savedResumeId: string;
  setSelectedResume: (content: string, filename: string, id?: string) => void;
  setPrefill: (jd: string, company?: string, role?: string) => void;
  setSelectedTemplate: (template: TemplateId) => void;
  setAccentColor: (color: string) => void;
  setFontStyle: (font: FontStyle) => void;
  setTailoredContent: (content: TailoredContent | null) => void;
  setDraftContent: (content: TailoredContent | null) => void;
  setEditorPrefs: (prefs: Partial<EditorPrefs>) => void;
  setActiveApplication: (id: string) => void;
  setSavedResumeId: (id: string) => void;
  openResume: (resumeId: string, applicationId: string, content: TailoredContent) => void;
  clear: () => void;
}

export const useResumeLabStore = create<ResumeLabState>()(
  persist(
    (set) => ({
      selectedResumeId: "",
      selectedContent: "",
      selectedFilename: "",
      prefillJd: "",
      prefillCompany: "",
      prefillRole: "",
      selectedTemplate: "classic",
      accentColor: "#2563eb",
      fontStyle: "sans",
      tailoredContent: null,
      draftContent: null,
      editorPrefs: { ...DEFAULT_EDITOR_PREFS },
      activeApplicationId: "",
      savedResumeId: "",
      setSelectedResume: (content, filename, id = "") =>
        set({ selectedContent: content, selectedFilename: filename, selectedResumeId: id }),
      setPrefill: (jd, company = "", role = "") =>
        set({ prefillJd: jd, prefillCompany: company, prefillRole: role }),
      setSelectedTemplate: (template) => set({ selectedTemplate: template }),
      setAccentColor: (color) => set({ accentColor: color }),
      setFontStyle: (font) => set({ fontStyle: font }),
      setTailoredContent: (content) => set(content !== null
        // New AI result — reset draft + editor prefs so editor starts fresh
        ? { tailoredContent: content, draftContent: null, editorPrefs: { ...DEFAULT_EDITOR_PREFS } }
        // null = Back button — keep prefs so returning restores the session
        : { tailoredContent: null }),
      setDraftContent: (content) => set({ draftContent: content }),
      setEditorPrefs: (prefs) =>
        set(state => ({ editorPrefs: { ...state.editorPrefs, ...prefs } })),
      setActiveApplication: (id) => set({ activeApplicationId: id, savedResumeId: "" }),
      setSavedResumeId: (id) => set({ savedResumeId: id }),
      openResume: (resumeId, applicationId, content) =>
        // Always preserve editorPrefs across Edit cycles.
        // draftContent (inline text edits) only preserved for the exact same resume.
        set(state => ({
          savedResumeId: resumeId,
          activeApplicationId: applicationId,
          tailoredContent: content,
          draftContent: state.savedResumeId === resumeId ? state.draftContent : null,
          editorPrefs: state.editorPrefs,
        })),
      clear: () => set({
        selectedResumeId: "", selectedContent: "", selectedFilename: "",
        prefillJd: "", prefillCompany: "", prefillRole: "",
        tailoredContent: null, draftContent: null,
        editorPrefs: { ...DEFAULT_EDITOR_PREFS },
        activeApplicationId: "", savedResumeId: "",
      }),
    }),
    {
      name: "applyflow-editor-prefs",
      storage: createJSONStorage(() => localStorage),
      // Only persist user preference fields — never the large content objects
      partialize: (state) => ({
        selectedTemplate: state.selectedTemplate,
        accentColor: state.accentColor,
        fontStyle: state.fontStyle,
        editorPrefs: state.editorPrefs,
        savedResumeId: state.savedResumeId,
      }),
    },
  ),
);
