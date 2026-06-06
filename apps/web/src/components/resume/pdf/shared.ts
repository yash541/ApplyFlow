import { Font } from "@react-pdf/renderer";
import type { TailoredContent, FontStyle, TemplateId, SkillGroup } from "@/store/resumeLab";

// Disable react-pdf's built-in hyphenation — it inserts hyphens mid-word at line breaks
Font.registerHyphenationCallback(word => [word]);

// External font registration is intentionally omitted — fetching fonts at
// render time over the network blocks PDF generation. Templates use built-in
// PDF fonts (Helvetica, Times-Roman) which render instantly with no network calls.

export type { TailoredContent };

export type SectionId = "summary" | "experience" | "education" | "skills" | "projects" | "certifications";
export const BUILTIN_SECTION_IDS = ["summary", "experience", "education", "skills", "projects", "certifications"] as const;
// "projects" and "certifications" are omitted from the default order —
// they are injected dynamically only when content has entries.
export const DEFAULT_SECTION_ORDER: string[] = ["summary", "experience", "education", "skills"];

const BUILTIN_LABELS: Record<string, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
};

export function getSectionLabel(id: string, content: TailoredContent): string {
  if (content.sectionNames?.[id]) return content.sectionNames[id]!;
  if (BUILTIN_LABELS[id]) return BUILTIN_LABELS[id]!;
  return content.customSections?.find(s => s.id === id)?.label ?? id;
}

// ─── Skill group helpers ──────────────────────────────────────────────────────
export { type SkillGroup };

export function flattenSkills(content: TailoredContent): string[] {
  return content.skillGroups?.flatMap(g => g.items) ?? content.skills;
}

const SKILL_CATS: { label: string; kw: string[] }[] = [
  { label: "Languages",   kw: ["java", "javascript", "typescript", "python", "c++", "c#", "ruby", "go ", "golang", "rust", "scala", "kotlin", "swift", "php", "matlab", "r ", " r,", "perl", "lua", "haskell", "elixir", "clojure"] },
  { label: "Frameworks & Libraries", kw: ["react", "angular", "vue", "node.js", "node ", "spring", "django", "flask", "express", "next.js", "next ", "nestjs", "nest.js", ".net", "rails", "laravel", "fastapi", "gin", "fiber", "svelte", "jquery", "bootstrap", "tailwind", "redux", "graphql", "grpc", "rest", "restful", "html", "css"] },
  { label: "Databases",   kw: ["mysql", "postgresql", "postgres", "mongodb", "redis", "oracle", "cassandra", "dynamodb", "elasticsearch", "sqlite", "nosql", "sql", "database", "mariadb", "neo4j", "firestore", "supabase"] },
  { label: "Cloud & DevOps", kw: ["aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s", "ci/cd", "jenkins", "terraform", "ansible", "helm", "ecs", "ec2", "lambda", "s3 ", "rds", "sqs", "sns", "cloudwatch", "splunk", "pcf", "openshift", "circleci", "github actions", "gitlab ci", "datadog", "nginx", "linux"] },
  { label: "Tools",       kw: ["git", "github", "gitlab", "bitbucket", "jira", "confluence", "figma", "postman", "intellij", "vscode", "xcode", "vim", "swagger", "maven", "gradle", "npm", "yarn", "webpack", "babel"] },
];

export function autoGroupSkills(skills: string[]): SkillGroup[] {
  const assigned = new Set<number>();
  const groups: SkillGroup[] = [];
  for (const cat of SKILL_CATS) {
    const items: string[] = [];
    skills.forEach((s, i) => {
      if (assigned.has(i)) return;
      const sl = s.toLowerCase();
      if (cat.kw.some(kw => sl.includes(kw))) { items.push(s); assigned.add(i); }
    });
    if (items.length > 0) groups.push({ label: cat.label, items });
  }
  const remaining = skills.filter((_, i) => !assigned.has(i));
  if (remaining.length > 0) groups.push({ label: groups.length === 0 ? "" : "Concepts & Methods", items: remaining });
  return groups;
}

export interface LayoutOverrides {
  spacing: number;      // 0.7–2.5  — gap between sections/bullets
  margins: number;      // 0.6–1.4  — page padding multiplier
  fontDelta: number;    // -2 to +2 — added to all font sizes
  sidebarWidth: number; // 130–200  — Modern template sidebar (pt)
}

export const DEFAULT_LAYOUT: LayoutOverrides = {
  spacing: 1.0,
  margins: 1.0,
  fontDelta: 0,
  sidebarWidth: 162,
};

export interface TemplateProps {
  content: TailoredContent;
  accentColor: string;
  fontStyle: FontStyle;
  compact: boolean;
  layout?: Partial<LayoutOverrides>;
  sectionOrder?: string[];
  /** Modern template only: which column each section belongs to */
  columnMap?: Record<string, "sidebar" | "main">;
}

// ─── Typography helpers ───────────────────────────────────────────────────────
export function fontFamily(style: FontStyle, bold = false): string {
  if (style === "serif") return bold ? "Times-Bold" : "Times-Roman";
  return bold ? "Helvetica-Bold" : "Helvetica";
}

export function fontItalic(style: FontStyle): string {
  return style === "serif" ? "Times-Italic" : "Helvetica-Oblique";
}

export function contactLine(contact: TailoredContent["contact"]): string {
  return [contact.email, contact.phone, contact.location, contact.linkedin, contact.github, contact.website]
    .filter(Boolean)
    .join("  ·  ");
}

// ─── Inline text parser ───────────────────────────────────────────────────────
export interface TextSegment {
  text: string;
  href?: string;
  bold?: boolean;
}

// Parses [text](url) markdown links from any text field (legacy, kept for compat)
export function parseInlineLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }
    const raw = match[2]!.trim();
    const href = raw.startsWith("http://") || raw.startsWith("https://")
      ? raw
      : raw.includes("@") ? `mailto:${raw}` : `https://${raw}`;
    segments.push({ text: match[1]!, href });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }
  return segments;
}

// Auto-bold pattern — matches standout metrics in resume bullets:
//   percentages   ~40%, 99.9%, 100%
//   dollar        $1M, $50K+, $100,000
//   scale suffix  50K+, 1.5M, 10B
//   plain "100+"  style
//   multipliers   3x, 10×
const _METRIC_RE =
  /~?\d[\d,]*\.?\d*%|\$\d[\d,.]*[kKmMbBtT]?[+]?|\b\d[\d,.]*[kKmMbBtT][+]?(?=[\s,;.)\]]|$)|\b\d[\d,.]*\+(?=[\s,;.)\]]|$)|\b\d+\.?\d*[×x](?=[\s,;.)\]]|$)/g;

function _applyAutoBold(text: string, out: TextSegment[]): void {
  let last = 0;
  _METRIC_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = _METRIC_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], bold: true });
    last = _METRIC_RE.lastIndex;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  else if (!out.length) out.push({ text });
}

/**
 * Full inline parser for resume text.
 * Handles, in order of precedence:
 *  1. **bold** markdown  → bold: true
 *  2. [link](url)        → href
 *  3. auto-bold metrics  → bold: true on numbers/percentages/multipliers
 */
export function parseRichText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const mdRe = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = mdRe.exec(text)) !== null) {
    if (m.index > last) _applyAutoBold(text.slice(last, m.index), segments);
    if (m[1] !== undefined) {
      // **bold**
      segments.push({ text: m[1], bold: true });
    } else {
      // [text](url)
      const raw = m[3]!.trim();
      const href = raw.startsWith("http://") || raw.startsWith("https://")
        ? raw : raw.includes("@") ? `mailto:${raw}` : `https://${raw}`;
      segments.push({ text: m[2]!, href });
    }
    last = mdRe.lastIndex;
  }
  if (last < text.length) _applyAutoBold(text.slice(last), segments);
  return segments.length ? segments : [{ text }];
}

export function toHref(value: string): string | undefined {
  const v = value.trim();
  if (!v) return undefined;
  if (v.includes("@")) return `mailto:${v}`;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  // Looks like a URL domain (no spaces, has a dot, not a phone number)
  if (!v.includes(" ") && v.includes(".") && !/^\+?\d[\d\s\-().]+$/.test(v)) return `https://${v}`;
  return undefined;
}

// ─── Compact config — all spacing lives here, templates just reference it ─────
export interface TemplateConfig {
  fs: number;         // base font size
  fsSmall: number;    // small text
  fsTiny: number;     // tiny labels
  fsName: number;     // name/heading
  pagePad: string;    // page padding shorthand (top/side)
  secGap: number;     // gap between sections
  jobGap: number;     // gap between job entries
  bulletGap: number;  // gap between bullets
  headerGap: number;  // gap after section label
  m: number;          // margins multiplier (exposed so templates can scale custom padding)
}

export function makeConfig(compact: boolean, overrides: Partial<LayoutOverrides> = {}): TemplateConfig {
  if (compact) {
    return {
      fs: 9, fsSmall: 8, fsTiny: 7.5, fsName: 18,
      pagePad: "22pt 32pt",
      secGap: 7, jobGap: 5, bulletGap: 1.5, headerGap: 3,
      m: 1.0,
    };
  }
  const s = Math.max(0.7, overrides.spacing ?? 1.0);
  const m = Math.max(0.6, Math.min(1.4, overrides.margins ?? 1.0));
  const fd = Math.max(-2, Math.min(2, overrides.fontDelta ?? 0));
  const padTop = Math.round(40 * m);
  const padSide = Math.round(52 * m);
  return {
    fs: 10 + fd,
    fsSmall: 9 + fd,
    fsTiny: 8.5 + fd,
    fsName: 22 + fd * 2,
    pagePad: `${padTop}pt ${padSide}pt`,
    secGap: +(12 * s).toFixed(1),
    jobGap:  +(10 * s).toFixed(1),
    bulletGap: +(2.5 * s).toFixed(1),
    headerGap: +(6 * s).toFixed(1),
    m,
  };
}

// ─── Content analysis ─────────────────────────────────────────────────────────
export interface ContentIssue {
  type: "long_bullet" | "many_skills" | "overflow";
  label: string;
  severity: "warn" | "ok";
  expIdx?: number;
  bulletIdx?: number;
}

export interface ContentAnalysis {
  issues: ContentIssue[];
  estimatedPages: number;
  longBulletCount: number;
  skillsCount: number;
  recommendedSpacing: number;
}

export function analyzeContent(
  content: TailoredContent,
  template: TemplateId,
): ContentAnalysis {
  const issues: ContentIssue[] = [];

  // Long bullets
  let longBulletCount = 0;
  content.experience.forEach((exp, expIdx) => {
    exp.bullets.forEach((b, bulletIdx) => {
      if (b.length > 250) {
        longBulletCount++;
        issues.push({
          type: "long_bullet",
          label: `"${exp.title}" bullet ${bulletIdx + 1} is ${b.length} chars`,
          severity: "warn",
          expIdx,
          bulletIdx,
        });
      }
    });
  });

  // Skills count
  const allSkills = flattenSkills(content);
  const skillsCount = allSkills.length;
  if (skillsCount > 18) {
    issues.push({
      type: "many_skills",
      label: `${skillsCount} skills listed — top 18 recommended`,
      severity: "warn",
    });
  }

  // Page estimate
  const twoCol = template === "modern";
  const cpl = twoCol ? 62 : 88; // chars per line
  const lpp = twoCol ? 54 : 58; // lines per page

  let lines = 3; // name + contact + gap
  if (content.summary) {
    lines += 1.5 + Math.ceil(content.summary.length / cpl) + 0.5;
  }
  if (content.experience.length > 0) {
    lines += 1.5;
    for (const exp of content.experience) {
      lines += 2;
      for (const b of exp.bullets) lines += Math.max(1, Math.ceil(b.length / cpl));
      lines += 0.8;
    }
  }
  if (content.education.length > 0) {
    lines += 1.5 + content.education.length * 2.5;
  }
  if (allSkills.length > 0) {
    lines += 1.5 + Math.ceil(allSkills.join(" · ").length / cpl);
  }

  const estimatedPages = lines / lpp;

  if (estimatedPages > 1.05) {
    issues.push({
      type: "overflow",
      label: `~${estimatedPages.toFixed(1)} pages estimated`,
      severity: "warn",
    });
  }

  // Compute spacing scale to fill ~90% of the page.
  // estimatedPages (line-count based) over-counts actual fill by ~34%.
  // Calibrated: when E=1.09 from this resume, actual fill ≈ 72%, so factor = 0.66.
  // Of actual fill, ~73% is text height, ~27% is spacing gaps.
  // We solve: textPages + scale * spacingPages = 0.90
  const FILL_CORRECTION = 0.66;
  const TEXT_RATIO = 0.73;
  const SPACING_RATIO = 0.27;
  const TARGET_FILL = 0.90;
  const correctedFill = estimatedPages * FILL_CORRECTION;
  const textPages = correctedFill * TEXT_RATIO;
  const spacingPages = correctedFill * SPACING_RATIO;
  const recommendedSpacing =
    correctedFill < 0.86 && spacingPages > 0
      ? Math.min(2.5, Math.max(1.0, (TARGET_FILL - textPages) / spacingPages))
      : 1.0;

  return { issues, estimatedPages, longBulletCount, skillsCount, recommendedSpacing };
}
