"use client";

import { useState, useEffect, useCallback } from "react";
import {
  User, Phone, MapPin, Linkedin, Github, Globe, Briefcase, GraduationCap,
  Sparkles, Check, Loader2, Plus, X, ChevronDown, ChevronUp, Save,
  Pencil, AlertCircle, DollarSign, Zap, FileText,
} from "lucide-react";
import { api, type MasterProfileData, type WorkEntry, type EducationEntry, type ResumeData } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_DATA: MasterProfileData = {
  phone: "", location: "", linkedin: "", github: "", website: "",
  headline: "", summary: "",
  experience: [], education: [], skills: [],
  work_authorization: "", requires_sponsorship: false,
  salary_min: null, salary_max: null, salary_currency: "USD",
  willing_to_relocate: false, relocation_details: "",
  remote_preference: "flexible", notice_period: "2 weeks",
  years_experience: null,
  gender: "", ethnicity: "", disability_status: "", veteran_status: "",
};

// ── Tiny primitives ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-on-surface-variant/60 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder = "", type = "text",
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
    />
  );
}

function TextArea({
  value, onChange, placeholder = "", rows = 3,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all resize-none leading-relaxed"
    />
  );
}

function Select({
  value, onChange, options,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all appearance-none"
    >
      <option value="" className="bg-surface">Select…</option>
      {options.map(o => (
        <option key={o.value} value={o.value} className="bg-surface">{o.label}</option>
      ))}
    </select>
  );
}

function Toggle({
  checked, onChange, label,
}: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 group"
    >
      <div className={`w-10 h-5 rounded-full transition-all relative ${checked ? "bg-primary" : "bg-white/10"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-5.5" : "left-0.5"}`} style={{ left: checked ? "calc(100% - 18px)" : "2px" }} />
      </div>
      <span className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">{label}</span>
    </button>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-container/40 border border-white/8 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
        <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Completion meter ──────────────────────────────────────────────────────────

function calcCompletion(name: string, data: MasterProfileData): number {
  const checks = [
    !!name,
    !!data.phone,
    !!data.location,
    !!data.linkedin,
    !!data.headline,
    !!data.summary,
    data.experience.length > 0,
    data.education.length > 0,
    data.skills.length >= 3,
    !!data.work_authorization,
    data.salary_min !== null,
    !!data.remote_preference,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// ── Work history editor ───────────────────────────────────────────────────────

function ExperienceEditor({
  experience, onChange,
}: {
  experience: WorkEntry[];
  onChange: (v: WorkEntry[]) => void;
}) {
  function add() {
    onChange([...experience, { title: "", company: "", duration: "", current: false, bullets: [""] }]);
  }
  function remove(i: number) {
    onChange(experience.filter((_, idx) => idx !== i));
  }
  function patch(i: number, key: keyof WorkEntry, value: WorkEntry[keyof WorkEntry]) {
    onChange(experience.map((e, idx) => idx === i ? { ...e, [key]: value } : e));
  }
  function patchBullet(i: number, j: number, val: string) {
    const updated = experience[i]!.bullets.map((b, bIdx) => bIdx === j ? val : b);
    patch(i, "bullets", updated);
  }
  function addBullet(i: number) {
    patch(i, "bullets", [...experience[i]!.bullets, ""]);
  }
  function removeBullet(i: number, j: number) {
    patch(i, "bullets", experience[i]!.bullets.filter((_, bIdx) => bIdx !== j));
  }

  return (
    <div className="space-y-3">
      {experience.map((job, i) => (
        <div key={i} className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-3">
          <div className="flex items-center gap-2">
            <input
              value={job.title}
              onChange={e => patch(i, "title", e.target.value)}
              placeholder="Job title"
              className="flex-1 h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-medium text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/40 min-w-0"
            />
            <button onClick={() => remove(i)} className="text-on-surface-variant/30 hover:text-red-400 transition-colors shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={job.company}
              onChange={e => patch(i, "company", e.target.value)}
              placeholder="Company"
              className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/40"
            />
            <input
              value={job.duration}
              onChange={e => patch(i, "duration", e.target.value)}
              placeholder="e.g. Jan 2022 – Present"
              className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/40"
            />
          </div>
          <div className="space-y-1.5">
            {job.bullets.map((b, j) => (
              <div key={j} className="flex items-start gap-1.5">
                <span className="text-primary/40 mt-2 text-xs shrink-0">•</span>
                <input
                  value={b}
                  onChange={e => patchBullet(i, j, e.target.value)}
                  placeholder="Achievement or responsibility…"
                  className="flex-1 h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/40 min-w-0"
                />
                <button onClick={() => removeBullet(i, j)} className="mt-1.5 text-on-surface-variant/20 hover:text-red-400 transition-colors shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button onClick={() => addBullet(i)} className="text-xs text-on-surface-variant/30 hover:text-primary/70 flex items-center gap-1 transition-colors">
              <Plus className="h-3 w-3" /> Add bullet
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={add}
        className="w-full py-2.5 rounded-xl border border-dashed border-white/10 text-xs text-on-surface-variant/30 hover:border-primary/30 hover:text-primary/60 transition-all flex items-center justify-center gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" /> Add experience
      </button>
    </div>
  );
}

// ── Education editor ──────────────────────────────────────────────────────────

function EducationEditor({
  education, onChange,
}: {
  education: EducationEntry[];
  onChange: (v: EducationEntry[]) => void;
}) {
  function add() {
    onChange([...education, { degree: "", institution: "", year: "" }]);
  }
  function remove(i: number) {
    onChange(education.filter((_, idx) => idx !== i));
  }
  function patch(i: number, key: keyof EducationEntry, value: string) {
    onChange(education.map((e, idx) => idx === i ? { ...e, [key]: value } : e));
  }

  return (
    <div className="space-y-3">
      {education.map((edu, i) => (
        <div key={i} className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={edu.degree}
              onChange={e => patch(i, "degree", e.target.value)}
              placeholder="Degree / Certification"
              className="flex-1 h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-medium text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/40 min-w-0"
            />
            <button onClick={() => remove(i)} className="text-on-surface-variant/30 hover:text-red-400 transition-colors shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={edu.institution}
              onChange={e => patch(i, "institution", e.target.value)}
              placeholder="Institution"
              className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/40"
            />
            <input
              value={edu.year}
              onChange={e => patch(i, "year", e.target.value)}
              placeholder="Year / Expected"
              className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/40"
            />
          </div>
        </div>
      ))}
      <button
        onClick={add}
        className="w-full py-2.5 rounded-xl border border-dashed border-white/10 text-xs text-on-surface-variant/30 hover:border-primary/30 hover:text-primary/60 transition-all flex items-center justify-center gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" /> Add education
      </button>
    </div>
  );
}

// ── Skills editor ─────────────────────────────────────────────────────────────

function SkillsEditor({ skills, onChange }: { skills: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");

  function add() {
    const trimmed = input.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    onChange([...skills, trimmed]);
    setInput("");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {skills.map(skill => (
          <span key={skill} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary">
            {skill}
            <button onClick={() => onChange(skills.filter(s => s !== skill))} className="hover:text-red-400 transition-colors">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {skills.length === 0 && (
          <span className="text-xs text-on-surface-variant/30 italic">No skills added yet</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Type a skill and press Enter…"
          className="flex-1 h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50"
        />
        <button onClick={add} className="h-8 px-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium hover:bg-primary/20 transition-all flex items-center gap-1">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MasterProfileForm() {
  const { user, setAuth, token } = useAuthStore();
  const [name, setName] = useState(user?.name ?? "");
  const [data, setData] = useState<MasterProfileData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [importState, setImportState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [importedFrom, setImportedFrom] = useState("");
  const [resumePicker, setResumePicker] = useState<ResumeData[] | null>(null);
  const [error, setError] = useState("");
  const [showEEO, setShowEEO] = useState(false);
  const [newSkill, setNewSkill] = useState("");

  const completion = calcCompletion(name, data);

  useEffect(() => {
    api.profile.get()
      .then(profile => {
        setName(profile.name);
        setData({ ...DEFAULT_DATA, ...profile.data });
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  function patch(updates: Partial<MasterProfileData>) {
    setData(prev => ({ ...prev, ...updates }));
  }

  async function handleSave() {
    setSaveState("saving");
    setError("");
    try {
      // Save name separately if changed
      if (name !== user?.name) {
        const res = await api.profile.updateName(name);
        if (token && user) setAuth({ ...user, name: res.name }, token);
      }
      await api.profile.update(data);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }

  async function handleImport() {
    setError("");
    try {
      const { resumes } = await api.resumes.list();
      const baseResumes = resumes.filter(r => r.type === "base");
      if (baseResumes.length === 0) {
        setError("No base resume found. Upload one in Resume Lab first.");
        return;
      }
      // Single base resume — import directly without showing a picker
      if (baseResumes.length === 1) {
        await runImport(baseResumes[0]!.id);
      } else {
        // Multiple base resumes — show picker modal
        setResumePicker(baseResumes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resumes");
    }
  }

  async function runImport(resumeId: string) {
    setResumePicker(null);
    setImportState("loading");
    setError("");
    try {
      const res = await api.profile.importFromResume(resumeId);
      setData(prev => ({
        ...prev,
        ...res.data,
        work_authorization: prev.work_authorization || res.data.work_authorization,
        salary_min: prev.salary_min ?? res.data.salary_min,
        salary_max: prev.salary_max ?? res.data.salary_max,
        gender: prev.gender || res.data.gender,
        ethnicity: prev.ethnicity || res.data.ethnicity,
        disability_status: prev.disability_status || res.data.disability_status,
        veteran_status: prev.veteran_status || res.data.veteran_status,
      }));
      setImportedFrom(res.resume_name);
      setImportState("done");
      setTimeout(() => setImportState("idle"), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setImportState("error");
      setTimeout(() => setImportState("idle"), 3000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">

      {/* Resume picker modal */}
      {resumePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-surface-container border border-white/10 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div>
                <h3 className="text-sm font-semibold text-on-surface">Choose a resume to import</h3>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">Profile fields will be populated from the selected resume</p>
              </div>
              <button onClick={() => setResumePicker(null)} className="text-on-surface-variant/40 hover:text-on-surface transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-3 space-y-1.5 max-h-80 overflow-y-auto">
              {resumePicker.map(r => (
                <button
                  key={r.id}
                  onClick={() => void runImport(r.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all text-left group"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">{r.name}</p>
                    <p className="text-xs text-on-surface-variant/50 mt-0.5 flex items-center gap-2">
                      {r.ats_score !== null && <span>ATS {r.ats_score}%</span>}
                      <span>{new Date(r.updated_at).toLocaleDateString()}</span>
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-on-surface-variant/30 group-hover:text-primary -rotate-90 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface font-display flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Autofill Profile
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant/60">
            Fill once. Auto-applied to every job form via the extension.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Import from resume */}
          <button
            onClick={() => void handleImport()}
            disabled={importState === "loading"}
            title="Populate fields from your uploaded base resume"
            className={`h-9 px-4 rounded-xl text-sm font-medium flex items-center gap-2 border transition-all disabled:opacity-50
              ${importState === "done"
                ? "bg-green-500/15 border-green-500/30 text-green-400"
                : importState === "error"
                ? "bg-red-500/15 border-red-500/30 text-red-400"
                : "bg-white/5 border-white/10 text-on-surface-variant hover:bg-white/10 hover:text-on-surface"}`}
          >
            {importState === "loading"
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
              : importState === "done"
              ? <><Check className="h-4 w-4" /> Imported</>
              : importState === "error"
              ? "Import failed"
              : <><FileText className="h-4 w-4" /> Import from Resume</>}
          </button>

          {/* Save */}
          <button
            onClick={() => void handleSave()}
            disabled={saveState === "saving"}
            className={`h-9 px-5 rounded-xl text-sm font-medium flex items-center gap-2 border transition-all disabled:opacity-50
              ${saveState === "saved"
                ? "bg-green-500/15 border-green-500/30 text-green-400"
                : saveState === "error"
                ? "bg-red-500/15 border-red-500/30 text-red-400"
                : "bg-primary/15 border-primary/30 text-primary hover:bg-primary/25"}`}
          >
            {saveState === "saving" ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              : saveState === "saved" ? <><Check className="h-4 w-4" /> Saved</>
              : saveState === "error" ? "Save failed"
              : <><Save className="h-4 w-4" /> Save Profile</>}
          </button>
        </div>
      </div>

      {/* Import success banner */}
      {importState === "done" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <Check className="h-4 w-4 shrink-0" />
          <span>
            Profile populated from <span className="font-semibold">{importedFrom}</span>. Review the fields below and click Save Profile when ready.
          </span>
        </div>
      )}

      {/* Completion bar */}
      <div className="rounded-xl bg-surface-container/40 border border-white/8 p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-on-surface-variant/60">Profile completeness</span>
            <span className={`text-sm font-bold ${completion >= 80 ? "text-green-400" : completion >= 50 ? "text-amber-400" : "text-on-surface-variant/50"}`}>
              {completion}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${completion >= 80 ? "bg-green-500" : completion >= 50 ? "bg-amber-400" : "bg-primary"}`}
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
        {completion >= 80 && (
          <div className="flex items-center gap-1.5 text-green-400 shrink-0">
            <Check className="h-4 w-4" />
            <span className="text-xs font-medium">Ready to autofill</span>
          </div>
        )}
        {completion < 80 && (
          <span className="text-xs text-on-surface-variant/40 shrink-0">
            {12 - Math.round(completion / 100 * 12)} fields left
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Personal Info ───────────────────────────────────────────────────── */}
      <SectionCard title="Personal Info" icon={User}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full Name">
              <TextInput value={name} onChange={setName} placeholder="Your full name" />
            </Field>
            <Field label="Email">
              <div className="h-9 px-3 flex items-center rounded-lg bg-white/3 border border-white/6 text-sm text-on-surface-variant/50 select-none">
                {user?.email}
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-variant/30" />
                <input
                  type="tel"
                  value={data.phone}
                  onChange={e => patch({ phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="w-full h-9 pl-8 pr-3 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>
            </Field>
            <Field label="Location">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-variant/30" />
                <input
                  value={data.location}
                  onChange={e => patch({ location: e.target.value })}
                  placeholder="City, State"
                  className="w-full h-9 pl-8 pr-3 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="LinkedIn URL">
              <div className="relative">
                <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-variant/30" />
                <input
                  value={data.linkedin}
                  onChange={e => patch({ linkedin: e.target.value })}
                  placeholder="linkedin.com/in/…"
                  className="w-full h-9 pl-8 pr-3 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>
            </Field>
            <Field label="GitHub URL">
              <div className="relative">
                <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-variant/30" />
                <input
                  value={data.github}
                  onChange={e => patch({ github: e.target.value })}
                  placeholder="github.com/…"
                  className="w-full h-9 pl-8 pr-3 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>
            </Field>
            <Field label="Portfolio / Website">
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-variant/30" />
                <input
                  value={data.website}
                  onChange={e => patch({ website: e.target.value })}
                  placeholder="yoursite.com"
                  className="w-full h-9 pl-8 pr-3 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* ── Professional ────────────────────────────────────────────────────── */}
      <SectionCard title="Professional Headline" icon={Sparkles}>
        <div className="space-y-4">
          <Field label="Headline">
            <TextInput
              value={data.headline}
              onChange={v => patch({ headline: v })}
              placeholder="e.g. Senior Software Engineer · Full-stack · Open to remote"
            />
          </Field>
          <Field label="Tell us about yourself">
            <TextArea
              value={data.summary}
              onChange={v => patch({ summary: v })}
              placeholder="2–3 sentences. Used to fill 'About you' and open-ended intro fields on applications."
              rows={4}
            />
          </Field>
        </div>
      </SectionCard>

      {/* ── Work History ────────────────────────────────────────────────────── */}
      <SectionCard title="Work History" icon={Briefcase}>
        <ExperienceEditor experience={data.experience} onChange={v => patch({ experience: v })} />
      </SectionCard>

      {/* ── Education ───────────────────────────────────────────────────────── */}
      <SectionCard title="Education" icon={GraduationCap}>
        <EducationEditor education={data.education} onChange={v => patch({ education: v })} />
      </SectionCard>

      {/* ── Skills ──────────────────────────────────────────────────────────── */}
      <SectionCard title="Skills" icon={Pencil}>
        <SkillsEditor skills={data.skills} onChange={v => patch({ skills: v })} />
      </SectionCard>

      {/* ── Application Q&A ─────────────────────────────────────────────────── */}
      <SectionCard title="Application Q&A" icon={Zap}>
        <div className="space-y-5">
          <div className="flex items-center gap-1.5 text-xs text-primary/70 bg-primary/8 rounded-lg px-3 py-2 border border-primary/15">
            <Zap className="h-3 w-3 shrink-0" />
            These answers auto-fill the recurring questions on every job application — the biggest time-saver.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Work Authorization">
              <Select
                value={data.work_authorization}
                onChange={v => patch({ work_authorization: v })}
                options={[
                  { value: "us_citizen", label: "US Citizen" },
                  { value: "green_card", label: "Green Card / PR" },
                  { value: "h1b", label: "H-1B Visa" },
                  { value: "opt", label: "OPT / STEM OPT" },
                  { value: "ead", label: "EAD / Other work permit" },
                  { value: "tn_visa", label: "TN Visa" },
                  { value: "other", label: "Other" },
                ]}
              />
            </Field>
            <Field label="Notice Period">
              <Select
                value={data.notice_period}
                onChange={v => patch({ notice_period: v })}
                options={[
                  { value: "immediately", label: "Available immediately" },
                  { value: "1 week", label: "1 week" },
                  { value: "2 weeks", label: "2 weeks" },
                  { value: "1 month", label: "1 month" },
                  { value: "2+ months", label: "2+ months" },
                ]}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Years of Total Experience">
              <input
                type="number"
                min={0}
                max={50}
                value={data.years_experience ?? ""}
                onChange={e => patch({ years_experience: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="e.g. 5"
                className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </Field>
            <Field label="Remote Preference">
              <div className="flex gap-1.5 h-9 items-center">
                {(["remote", "hybrid", "onsite", "flexible"] as const).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => patch({ remote_preference: opt })}
                    className={`flex-1 h-8 rounded-lg text-xs font-medium border transition-all capitalize
                      ${data.remote_preference === opt
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-white/3 border-white/10 text-on-surface-variant/50 hover:bg-white/8"}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="space-y-2">
            <Toggle
              checked={data.requires_sponsorship}
              onChange={v => patch({ requires_sponsorship: v })}
              label="Requires visa sponsorship"
            />
          </div>

          {/* Salary */}
          <div>
            <label className="block text-xs font-medium text-on-surface-variant/60 uppercase tracking-wider mb-1.5">
              Salary Expectation
            </label>
            <div className="flex items-center gap-2">
              <select
                value={data.salary_currency}
                onChange={e => patch({ salary_currency: e.target.value })}
                className="h-9 px-2 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface focus:outline-none focus:border-primary/50 appearance-none w-20"
              >
                {["USD", "EUR", "GBP", "CAD", "AUD", "INR"].map(c => (
                  <option key={c} value={c} className="bg-surface">{c}</option>
                ))}
              </select>
              <div className="relative flex-1">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-variant/30" />
                <input
                  type="number"
                  value={data.salary_min ?? ""}
                  onChange={e => patch({ salary_min: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Min"
                  className="w-full h-9 pl-7 pr-3 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>
              <span className="text-on-surface-variant/30 text-sm">–</span>
              <div className="relative flex-1">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-variant/30" />
                <input
                  type="number"
                  value={data.salary_max ?? ""}
                  onChange={e => patch({ salary_max: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Max"
                  className="w-full h-9 pl-7 pr-3 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Relocation */}
          <div className="space-y-2">
            <Toggle
              checked={data.willing_to_relocate}
              onChange={v => patch({ willing_to_relocate: v })}
              label="Willing to relocate"
            />
            {data.willing_to_relocate && (
              <input
                value={data.relocation_details}
                onChange={e => patch({ relocation_details: e.target.value })}
                placeholder="e.g. Open to Bay Area, NYC, Austin"
                className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              />
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── EEO (collapsible) ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-surface-container/40 border border-white/8 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowEEO(v => !v)}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/3 transition-colors"
        >
          <div className="h-7 w-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <User className="h-3.5 w-3.5 text-on-surface-variant/40" />
          </div>
          <div className="flex-1 text-left">
            <span className="text-sm font-semibold text-on-surface">EEO / Diversity Fields</span>
            <span className="ml-2 text-xs text-on-surface-variant/40">Optional · stored only for your use</span>
          </div>
          {showEEO ? <ChevronUp className="h-4 w-4 text-on-surface-variant/40" /> : <ChevronDown className="h-4 w-4 text-on-surface-variant/40" />}
        </button>

        {showEEO && (
          <div className="px-5 pb-5 grid grid-cols-2 gap-4 border-t border-white/5 pt-5">
            <Field label="Gender">
              <Select
                value={data.gender}
                onChange={v => patch({ gender: v })}
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "nonbinary", label: "Non-binary" },
                  { value: "prefer_not", label: "Prefer not to say" },
                ]}
              />
            </Field>
            <Field label="Ethnicity">
              <Select
                value={data.ethnicity}
                onChange={v => patch({ ethnicity: v })}
                options={[
                  { value: "asian", label: "Asian" },
                  { value: "black", label: "Black or African American" },
                  { value: "hispanic", label: "Hispanic or Latino" },
                  { value: "white", label: "White" },
                  { value: "two_or_more", label: "Two or more races" },
                  { value: "prefer_not", label: "Prefer not to say" },
                ]}
              />
            </Field>
            <Field label="Disability Status">
              <Select
                value={data.disability_status}
                onChange={v => patch({ disability_status: v })}
                options={[
                  { value: "no", label: "No disability" },
                  { value: "yes", label: "Yes, I have a disability" },
                  { value: "prefer_not", label: "Prefer not to say" },
                ]}
              />
            </Field>
            <Field label="Veteran Status">
              <Select
                value={data.veteran_status}
                onChange={v => patch({ veteran_status: v })}
                options={[
                  { value: "not_veteran", label: "Not a veteran" },
                  { value: "veteran", label: "Veteran" },
                  { value: "prefer_not", label: "Prefer not to say" },
                ]}
              />
            </Field>
          </div>
        )}
      </div>

      {/* Bottom save */}
      <div className="flex justify-end pb-8">
        <button
          onClick={() => void handleSave()}
          disabled={saveState === "saving"}
          className={`h-10 px-8 rounded-xl text-sm font-medium flex items-center gap-2 border transition-all disabled:opacity-50
            ${saveState === "saved"
              ? "bg-green-500/15 border-green-500/30 text-green-400"
              : saveState === "error"
              ? "bg-red-500/15 border-red-500/30 text-red-400"
              : "bg-primary/15 border-primary/30 text-primary hover:bg-primary/25"}`}
        >
          {saveState === "saving" ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            : saveState === "saved" ? <><Check className="h-4 w-4" /> Saved</>
            : saveState === "error" ? "Save failed — retry"
            : <><Save className="h-4 w-4" /> Save Profile</>}
        </button>
      </div>
    </div>
  );
}
