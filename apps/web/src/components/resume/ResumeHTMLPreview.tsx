"use client";

import type { TailoredContent, TemplateId, FontStyle, CustomSection } from "@/store/resumeLab";
import type { SectionId, LayoutOverrides } from "./pdf/shared";
import { parseRichText, getSectionLabel } from "./pdf/shared";

interface PreviewProps {
  content: TailoredContent;
  templateId: TemplateId;
  accentColor: string;
  fontStyle: FontStyle;
  compact: boolean;
  sectionOrder: string[];
  layout?: Partial<LayoutOverrides>;
  /** Modern template only */
  columnMap?: Record<string, "sidebar" | "main">;
}

interface Cfg {
  fs: number; fsSmall: number; fsTiny: number; fsName: number;
  padH: number; padV: number;
  secGap: number; jobGap: number; bulletGap: number; headerGap: number;
  sidebarW: number;
}

// Mirrors makeConfig() in shared.ts exactly — same numbers so HTML matches PDF
function makeCfg(compact: boolean, layout: Partial<LayoutOverrides> = {}): Cfg {
  if (compact) {
    return { fs: 9, fsSmall: 8, fsTiny: 7.5, fsName: 18, padH: 32, padV: 22, secGap: 7, jobGap: 5, bulletGap: 1.5, headerGap: 3, sidebarW: 140 };
  }
  const s = Math.max(0.7, layout.spacing ?? 1.0);
  const m = Math.max(0.6, Math.min(1.4, layout.margins ?? 1.0));
  const fd = Math.max(-2, Math.min(2, layout.fontDelta ?? 0));
  return {
    fs: 10 + fd, fsSmall: 9 + fd, fsTiny: 8.5 + fd, fsName: 22 + fd * 2,
    padH: Math.round(52 * m), padV: Math.round(40 * m),
    secGap: +(12 * s).toFixed(1), jobGap: +(10 * s).toFixed(1),
    bulletGap: +(2.5 * s).toFixed(1), headerGap: +(6 * s).toFixed(1),
    sidebarW: layout.sidebarWidth ?? 162,
  };
}

function contactItems(c: TailoredContent["contact"]) {
  return [c.email, c.phone, c.location, c.linkedin, c.github, c.website].filter((v): v is string => !!v?.trim());
}

function toHref(v: string): string | undefined {
  if (v.includes("@")) return `mailto:${v}`;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (!v.includes(" ") && v.includes(".") && !/^\+?\d[\d\s\-().]+$/.test(v)) return `https://${v}`;
  return undefined;
}

function resolveContact(item: string): { display: string; href?: string } {
  const segs = parseInlineLinks(item);
  if (segs.length === 1 && segs[0]?.href) return { display: segs[0].text, href: segs[0].href };
  return { display: item, href: toHref(item) };
}

function ContactRow({ contact, style, accentColor }: { contact: TailoredContent["contact"]; style: React.CSSProperties; accentColor: string }) {
  const items = contactItems(contact);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 0 }}>
      {items.map((item, i) => {
        const { display, href } = resolveContact(item);
        return (
          <span key={i} style={style}>
            {i > 0 && <span style={{ color: "#aaa" }}>{"  ·  "}</span>}
            {href
              ? <a href={href} target="_blank" rel="noreferrer" style={{ color: accentColor, textDecoration: "none" }}>{display}</a>
              : display}
          </span>
        );
      })}
    </div>
  );
}

function RichText({ text, accentColor }: { text: string; accentColor: string }) {
  const segments = parseRichText(text);
  if (segments.length === 1 && !segments[0]?.href && !segments[0]?.bold) return <>{text}</>;
  return (
    <>
      {segments.map((seg, i) =>
        seg.href ? (
          <a key={i} href={seg.href} target="_blank" rel="noreferrer"
            style={{ color: accentColor, textDecoration: "underline" }}>{seg.text}</a>
        ) : seg.bold ? (
          <strong key={i}>{seg.text}</strong>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

function CustomSectionPreview({
  section, accentColor, headerStyle, titleStyle, subtitleStyle,
  bulletStyle, bulletMarker, itemGap, bulletGap,
}: {
  section: CustomSection;
  accentColor: string;
  headerStyle: React.CSSProperties;
  titleStyle: React.CSSProperties;
  subtitleStyle: React.CSSProperties;
  bulletStyle: React.CSSProperties;
  bulletMarker: string;
  itemGap: number;
  bulletGap: number;
}) {
  if (section.items.length === 0) return null;
  return (
    <div>
      <p style={headerStyle}>{section.label}</p>
      {section.items.map((item, i) => (
        <div key={i} style={{ marginBottom: itemGap, pageBreakInside: "avoid", breakInside: "avoid" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 1 }}>
            <span style={titleStyle}>{item.title}</span>
            {item.subtitle && <span style={subtitleStyle}>{item.subtitle}</span>}
          </div>
          {item.bullets.map((b, j) => (
            <div key={j} style={{ display: "flex", gap: 5, marginBottom: bulletGap }}>
              <span style={{ color: accentColor, flexShrink: 0 }}>{bulletMarker}</span>
              <span style={bulletStyle}><RichText text={b} accentColor={accentColor} /></span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Shared helper to render a section by ID across all templates ───────────────
function renderCustom(id: string, content: TailoredContent, accentColor: string, headerStyle: React.CSSProperties, titleStyle: React.CSSProperties, subtitleStyle: React.CSSProperties, bulletStyle: React.CSSProperties, bulletMarker: string, itemGap: number, bulletGap: number) {
  const custom = content.customSections?.find(s => s.id === id);
  if (!custom) return null;
  return (
    <div key={id} style={{ marginBottom: itemGap * 1.5 }}>
      <CustomSectionPreview section={custom} accentColor={accentColor}
        headerStyle={headerStyle} titleStyle={titleStyle} subtitleStyle={subtitleStyle}
        bulletStyle={bulletStyle} bulletMarker={bulletMarker}
        itemGap={itemGap} bulletGap={bulletGap}
      />
    </div>
  );
}

// ── Classic ───────────────────────────────────────────────────────────────────
function ClassicPreview({ content, accentColor, fontStyle, compact, sectionOrder, layout }: PreviewProps) {
  const ff = fontStyle === "serif" ? "'Times New Roman', Times, serif" : "Helvetica, 'Helvetica Neue', Arial, sans-serif";
  const c = makeCfg(compact, layout);
  const hStyle: React.CSSProperties = { fontSize: c.fsTiny, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: accentColor, marginBottom: c.headerGap, pageBreakAfter: "avoid", breakAfter: "avoid" };

  const sections: Record<string, React.ReactNode> = {
    summary: content.summary ? (
      <div key="summary" style={{ marginBottom: c.secGap }}>
        <p style={hStyle}>{getSectionLabel("summary", content)}</p>
        <p style={{ fontSize: c.fsSmall, color: "#444", lineHeight: 1.55 }}><RichText text={content.summary} accentColor={accentColor} /></p>
      </div>
    ) : null,
    experience: content.experience.length > 0 ? (
      <div key="experience" style={{ marginBottom: c.secGap }}>
        <p style={hStyle}>{getSectionLabel("experience", content)}</p>
        {content.experience.map((job, i) => (
          <div key={i} style={{ marginBottom: c.jobGap, pageBreakInside: "avoid", breakInside: "avoid" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 1 }}>
              <span style={{ fontWeight: 700, fontSize: c.fs + 0.5 }}>{job.title}</span>
              <span style={{ fontSize: c.fsTiny, color: "#999" }}>{job.duration}</span>
            </div>
            <p style={{ fontSize: c.fsSmall, color: "#666", fontStyle: "italic", marginBottom: 3 }}>{job.company}</p>
            {job.bullets.map((b, j) => (
              <div key={j} style={{ display: "flex", gap: 5, marginBottom: c.bulletGap, paddingLeft: 4 }}>
                <span style={{ color: accentColor, flexShrink: 0, fontSize: c.fs }}>▸</span>
                <span style={{ fontSize: c.fsSmall, color: "#333", lineHeight: 1.4 }}><RichText text={b} accentColor={accentColor} /></span>
              </div>
            ))}
          </div>
        ))}
      </div>
    ) : null,
    education: content.education.length > 0 ? (
      <div key="education" style={{ marginBottom: c.secGap }}>
        <p style={hStyle}>{getSectionLabel("education", content)}</p>
        {content.education.map((edu, i) => (
          <div key={i} style={{ marginBottom: c.jobGap * 0.5, pageBreakInside: "avoid", breakInside: "avoid" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: c.fs }}>{edu.degree}</span>
              <span style={{ fontSize: c.fsTiny, color: "#999" }}>{edu.year}</span>
            </div>
            <p style={{ fontSize: c.fsSmall, color: "#666", fontStyle: "italic" }}>{edu.institution}</p>
          </div>
        ))}
      </div>
    ) : null,
    skills: content.skills.length > 0 ? (
      <div key="skills">
        <p style={hStyle}>{getSectionLabel("skills", content)}</p>
        <p style={{ fontSize: c.fsSmall, color: "#444" }}>{content.skills.join("   ·   ")}</p>
      </div>
    ) : null,
  };

  return (
    <div style={{ fontFamily: ff, padding: `${c.padV}px ${c.padH}px`, fontSize: c.fs, color: "#111", lineHeight: 1.4, textAlign: "justify" }}>
      <h1 style={{ fontSize: c.fsName, fontWeight: 700, marginBottom: 4, letterSpacing: -0.5, textAlign: "left" }}>{content.name || "Your Name"}</h1>
      <div style={{ borderBottom: `2px solid ${accentColor}`, marginBottom: 4 }} />
      <div style={{ marginBottom: c.secGap * 0.7 }}><ContactRow contact={content.contact} style={{ fontSize: c.fsSmall, color: "#555" }} accentColor={accentColor} /></div>
      {sectionOrder.map(id => id in sections ? (sections[id] ?? null) : renderCustom(id, content, accentColor, hStyle, { fontWeight: 700, fontSize: c.fs }, { fontSize: c.fsTiny, color: "#999" }, { fontSize: c.fsSmall, color: "#333", lineHeight: 1.4 }, "▸", c.jobGap, c.bulletGap))}
    </div>
  );
}

// ── Minimal ───────────────────────────────────────────────────────────────────
function MinimalPreview({ content, accentColor, fontStyle, compact, sectionOrder, layout }: PreviewProps) {
  const ff = fontStyle === "serif" ? "'Times New Roman', Times, serif" : "Helvetica, 'Helvetica Neue', Arial, sans-serif";
  const c = makeCfg(compact, layout);
  const hStyle: React.CSSProperties = { fontSize: c.fsTiny, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#111", marginBottom: c.headerGap, pageBreakAfter: "avoid", breakAfter: "avoid" };

  const sections: Record<string, React.ReactNode> = {
    summary: content.summary ? (
      <p key="summary" style={{ fontSize: c.fsSmall, color: "#444", marginBottom: c.secGap, lineHeight: 1.6 }}><RichText text={content.summary} accentColor={accentColor} /></p>
    ) : null,
    experience: content.experience.length > 0 ? (
      <div key="experience" style={{ marginBottom: c.secGap }}>
        <p style={hStyle}>{getSectionLabel("experience", content)}</p>
        {content.experience.map((job, i) => (
          <div key={i} style={{ marginBottom: c.jobGap, pageBreakInside: "avoid", breakInside: "avoid" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 1 }}>
              <span style={{ fontWeight: 700, fontSize: c.fs + 0.5 }}>{job.title}</span>
              <span style={{ fontSize: c.fsTiny, color: "#999" }}>{job.duration}</span>
            </div>
            <p style={{ fontSize: c.fsSmall, fontStyle: "italic", color: "#666", marginBottom: 3 }}>{job.company}</p>
            {job.bullets.map((b, j) => (
              <div key={j} style={{ display: "flex", gap: 8, marginBottom: c.bulletGap, paddingLeft: 6 }}>
                <span style={{ color: "#bbb", flexShrink: 0 }}>—</span>
                <span style={{ fontSize: c.fsSmall, color: "#333", lineHeight: 1.4 }}><RichText text={b} accentColor={accentColor} /></span>
              </div>
            ))}
          </div>
        ))}
      </div>
    ) : null,
    education: content.education.length > 0 ? (
      <div key="education" style={{ marginBottom: c.secGap }}>
        <p style={hStyle}>{getSectionLabel("education", content)}</p>
        {content.education.map((edu, i) => (
          <div key={i} style={{ marginBottom: c.jobGap * 0.4, pageBreakInside: "avoid", breakInside: "avoid" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: c.fs }}>{edu.degree}</span>
              <span style={{ fontSize: c.fsTiny, color: "#aaa" }}>{edu.year}</span>
            </div>
            <p style={{ fontSize: c.fsSmall, fontStyle: "italic", color: "#666" }}>{edu.institution}</p>
          </div>
        ))}
      </div>
    ) : null,
    skills: content.skills.length > 0 ? (
      <div key="skills">
        <p style={hStyle}>{getSectionLabel("skills", content)}</p>
        <p style={{ fontSize: c.fsSmall, color: "#444" }}>{content.skills.join("   ·   ")}</p>
      </div>
    ) : null,
  };

  return (
    <div style={{ fontFamily: ff, padding: `${c.padV}px ${c.padH}px`, fontSize: c.fs, color: "#111", textAlign: "justify" }}>
      <h1 style={{ fontSize: c.fsName, fontWeight: 700, marginBottom: c.headerGap, letterSpacing: -0.5, textAlign: "left" }}>{content.name || "Your Name"}</h1>
      <div style={{ marginBottom: c.secGap * 0.8 }}><ContactRow contact={content.contact} style={{ fontSize: c.fsSmall, color: "#666" }} accentColor={accentColor} /></div>
      {sectionOrder.map(id => id in sections ? (sections[id] ?? null) : renderCustom(id, content, accentColor, hStyle, { fontWeight: 700, fontSize: c.fs + 0.5 }, { fontSize: c.fsTiny, color: "#aaa" }, { fontSize: c.fsSmall, color: "#333", lineHeight: 1.4 }, "—", c.jobGap, c.bulletGap))}
    </div>
  );
}

// ── ATS Safe ──────────────────────────────────────────────────────────────────
function ATSPreview({ content, accentColor, fontStyle, compact, sectionOrder, layout }: PreviewProps) {
  const ff = fontStyle === "serif" ? "'Times New Roman', Times, serif" : "Helvetica, 'Helvetica Neue', Arial, sans-serif";
  const c = makeCfg(compact, layout);
  const hStyle: React.CSSProperties = { fontWeight: 700, fontSize: c.fs + 1, textTransform: "uppercase", marginBottom: c.headerGap, pageBreakAfter: "avoid", breakAfter: "avoid" };

  const sections: Record<string, React.ReactNode> = {
    summary: content.summary ? (
      <div key="summary" style={{ marginBottom: c.secGap }}>
        <p style={hStyle}>{getSectionLabel("summary", content)}</p>
        <p style={{ fontSize: c.fsSmall, color: "#111", lineHeight: 1.5 }}><RichText text={content.summary} accentColor={accentColor} /></p>
        <hr style={{ borderTop: "0.5px solid #999", marginTop: c.headerGap + 2, borderBottom: "none" }} />
      </div>
    ) : null,
    experience: content.experience.length > 0 ? (
      <div key="experience" style={{ marginBottom: c.secGap }}>
        <p style={hStyle}>{getSectionLabel("experience", content)}</p>
        {content.experience.map((job, i) => (
          <div key={i} style={{ marginBottom: c.jobGap, pageBreakInside: "avoid", breakInside: "avoid" }}>
            <p style={{ fontWeight: 700, fontSize: c.fs }}>{job.title}</p>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: c.fsSmall, fontStyle: "italic", color: "#333" }}>{job.company}</span>
              <span style={{ fontSize: c.fsTiny, color: "#333" }}>{job.duration}</span>
            </div>
            {job.bullets.map((b, j) => (
              <div key={j} style={{ display: "flex", gap: 5, marginBottom: c.bulletGap }}>
                <span style={{ flexShrink: 0, fontSize: c.fs }}>•</span>
                <span style={{ fontSize: c.fsSmall, lineHeight: 1.4 }}><RichText text={b} accentColor={accentColor} /></span>
              </div>
            ))}
          </div>
        ))}
        <hr style={{ borderTop: "0.5px solid #999", borderBottom: "none" }} />
      </div>
    ) : null,
    education: content.education.length > 0 ? (
      <div key="education" style={{ marginBottom: c.secGap }}>
        <p style={hStyle}>{getSectionLabel("education", content)}</p>
        {content.education.map((edu, i) => (
          <div key={i} style={{ marginBottom: c.jobGap * 0.4, pageBreakInside: "avoid", breakInside: "avoid" }}>
            <p style={{ fontWeight: 700, fontSize: c.fs }}>{edu.degree}</p>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: c.fsSmall, fontStyle: "italic", color: "#333" }}>{edu.institution}</span>
              <span style={{ fontSize: c.fsTiny, color: "#333" }}>{edu.year}</span>
            </div>
          </div>
        ))}
        <hr style={{ borderTop: "0.5px solid #999", borderBottom: "none" }} />
      </div>
    ) : null,
    skills: content.skills.length > 0 ? (
      <div key="skills">
        <p style={hStyle}>{getSectionLabel("skills", content)}</p>
        <p style={{ fontSize: c.fsSmall }}>{content.skills.join(" • ")}</p>
      </div>
    ) : null,
  };

  return (
    <div style={{ fontFamily: ff, padding: `${c.padV}px ${c.padH}px`, fontSize: c.fs, color: "#000", position: "relative", textAlign: "justify" }}>
      <div style={{ position: "absolute", top: c.padV, left: c.padH, right: c.padH, height: 2, backgroundColor: accentColor }} />
      <h1 style={{ fontSize: c.fsName - 2, fontWeight: 700, marginBottom: 2, textAlign: "left" }}>{content.name || "Your Name"}</h1>
      <div style={{ marginBottom: 4 }}><ContactRow contact={content.contact} style={{ fontSize: c.fsSmall, color: "#333" }} accentColor={accentColor} /></div>
      <hr style={{ borderTop: "2px solid #000", borderBottom: "none", marginBottom: c.headerGap + 2 }} />
      {sectionOrder.map(id => id in sections ? (sections[id] ?? null) : renderCustom(id, content, accentColor, hStyle, { fontWeight: 700, fontSize: c.fs }, { fontSize: c.fsTiny, color: "#333" }, { fontSize: c.fsSmall, lineHeight: 1.4 }, "•", c.jobGap, c.bulletGap))}
    </div>
  );
}

// ── Executive ─────────────────────────────────────────────────────────────────
function ExecutivePreview({ content, accentColor, fontStyle, compact, sectionOrder, layout }: PreviewProps) {
  const ff = fontStyle === "serif" ? "'Times New Roman', Times, serif" : "Helvetica, 'Helvetica Neue', Arial, sans-serif";
  const c = makeCfg(compact, layout);
  const bodyOrder = sectionOrder.filter(id => id === "summary" || id === "experience" || id.startsWith("custom_"));
  const showEdu = sectionOrder.includes("education") && content.education.length > 0;
  const showSkills = sectionOrder.includes("skills") && content.skills.length > 0;
  const hStyle: React.CSSProperties = { fontSize: c.fsTiny, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: accentColor, marginBottom: c.headerGap, pageBreakAfter: "avoid", breakAfter: "avoid" };

  const bodySections: Record<string, React.ReactNode> = {
    summary: content.summary ? (
      <div key="summary" style={{ marginBottom: c.secGap }}>
        <p style={hStyle}>{getSectionLabel("summary", content)}</p>
        <p style={{ fontSize: c.fsSmall, color: "#374151", fontStyle: "italic", lineHeight: 1.5 }}><RichText text={content.summary} accentColor={accentColor} /></p>
        <hr style={{ borderTop: "0.5px solid #e5e7eb", marginTop: c.headerGap + 3, borderBottom: "none" }} />
      </div>
    ) : null,
    experience: content.experience.length > 0 ? (
      <div key="experience" style={{ marginBottom: c.secGap }}>
        <p style={hStyle}>{getSectionLabel("experience", content)}</p>
        {content.experience.map((job, i) => (
          <div key={i} style={{ marginBottom: c.jobGap, pageBreakInside: "avoid", breakInside: "avoid" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 1 }}>
              <div style={{ width: 3, height: c.fs + 1, backgroundColor: accentColor, flexShrink: 0, marginTop: 2 }} />
              <span style={{ flex: 1, fontWeight: 700, fontSize: c.fs + 0.5 }}>{job.title}</span>
              <span style={{ fontSize: c.fsTiny, color: "#9ca3af" }}>{job.duration}</span>
            </div>
            <p style={{ fontSize: c.fsSmall, fontStyle: "italic", color: "#6b7280", marginBottom: 3, paddingLeft: 9 }}>{job.company}</p>
            {job.bullets.map((b, j) => (
              <div key={j} style={{ display: "flex", gap: 5, marginBottom: c.bulletGap, paddingLeft: 9 }}>
                <span style={{ color: accentColor, flexShrink: 0, fontSize: c.fs }}>▸</span>
                <span style={{ fontSize: c.fsSmall, color: "#374151", lineHeight: 1.4 }}><RichText text={b} accentColor={accentColor} /></span>
              </div>
            ))}
          </div>
        ))}
        <hr style={{ borderTop: "0.5px solid #e5e7eb", borderBottom: "none" }} />
      </div>
    ) : null,
  };

  return (
    <div style={{ fontFamily: ff, fontSize: c.fs, color: "#1a1a2e" }}>
      <div style={{ backgroundColor: accentColor, padding: `${c.padV * 0.7}px ${c.padH}px ${c.padV * 0.5}px` }}>
        <h1 style={{ fontSize: c.fsName, fontWeight: 700, color: "#fff", marginBottom: 2, textAlign: "left" }}>{content.name || "Your Name"}</h1>
        {content.experience[0] && <p style={{ fontSize: c.fsSmall - 1, color: "rgba(255,255,255,0.8)", fontStyle: "italic", marginBottom: 5 }}>{content.experience[0].title}</p>}
        <ContactRow contact={content.contact} style={{ fontSize: c.fsTiny, color: "rgba(255,255,255,0.7)" }} accentColor="rgba(255,255,255,0.95)" />
      </div>
      <div style={{ padding: `${c.padV * 0.6}px ${c.padH}px ${c.padV}px`, textAlign: "justify" }}>
        {bodyOrder.map(id => id in bodySections ? (bodySections[id] ?? null) : renderCustom(id, content, accentColor, hStyle, { fontWeight: 700, fontSize: c.fs + 0.5 }, { fontSize: c.fsTiny, color: "#9ca3af" }, { fontSize: c.fsSmall, color: "#374151", lineHeight: 1.4 }, "▸", c.jobGap, c.bulletGap))}
        {(showEdu || showSkills) && (
          <div style={{ display: "flex", gap: 16, marginTop: c.headerGap + 4 }}>
            {showEdu && (
              <div style={{ flex: 1 }}>
                <p style={hStyle}>{getSectionLabel("education", content)}</p>
                {content.education.map((edu, i) => (
                  <div key={i} style={{ marginBottom: 6, pageBreakInside: "avoid", breakInside: "avoid" }}>
                    <p style={{ fontWeight: 700, fontSize: c.fs }}>{edu.degree}</p>
                    <p style={{ fontSize: c.fsTiny, fontStyle: "italic", color: "#6b7280" }}>{edu.institution}</p>
                    <p style={{ fontSize: c.fsTiny, color: accentColor }}>{edu.year}</p>
                  </div>
                ))}
              </div>
            )}
            {showSkills && (
              <div style={{ flex: 1 }}>
                <p style={hStyle}>{getSectionLabel("skills", content)}</p>
                <p style={{ fontSize: c.fsSmall, color: "#374151" }}>{content.skills.join("  ·  ")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modern ────────────────────────────────────────────────────────────────────
function ModernPreview({ content, accentColor, fontStyle, compact, sectionOrder, layout, columnMap }: PreviewProps) {
  const ff = fontStyle === "serif" ? "'Times New Roman', Times, serif" : "Helvetica, 'Helvetica Neue', Arial, sans-serif";
  const c = makeCfg(compact, layout);

  function getCol(id: string): "sidebar" | "main" {
    if (columnMap?.[id]) return columnMap[id]!;
    return (id === "skills" || id === "education") ? "sidebar" : "main";
  }

  const sidebarOrder = sectionOrder.filter(id => getCol(id) === "sidebar");
  const mainOrder    = sectionOrder.filter(id => getCol(id) === "main");

  const sidebarLabel: React.CSSProperties = {
    fontSize: c.fsTiny - 1, fontWeight: 700, color: accentColor,
    textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4,
  };
  const sidebarGap = c.headerGap + 4;

  function renderSidebarSection(id: string) {
    if (id === "skills" && content.skills.length > 0) {
      const cap = compact ? 14 : 18;
      return (
        <div key={id} style={{ marginTop: sidebarGap }}>
          <p style={sidebarLabel}>{getSectionLabel("skills", content)}</p>
          {content.skills.slice(0, cap).map((skill, i) => (
            <div key={i} style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 3, padding: "2px 5px", marginBottom: 2.5 }}>
              <p style={{ fontSize: c.fsTiny - 1, color: "#e2e8f0" }}>{skill}</p>
            </div>
          ))}
          {content.skills.length > cap && (
            <p style={{ fontSize: c.fsTiny - 1, color: "#64748b", marginTop: 2 }}>+{content.skills.length - cap} more</p>
          )}
        </div>
      );
    }
    if (id === "education" && content.education.length > 0) {
      return (
        <div key={id} style={{ marginTop: sidebarGap }}>
          <p style={sidebarLabel}>{getSectionLabel("education", content)}</p>
          {content.education.map((edu, i) => (
            <div key={i} style={{ marginBottom: 6, pageBreakInside: "avoid", breakInside: "avoid" }}>
              <p style={{ fontSize: c.fsSmall - 0.5, fontWeight: 700, color: "#fff" }}>{edu.degree}</p>
              <p style={{ fontSize: c.fsTiny - 1, color: "#94a3b8" }}>{edu.institution}</p>
              <p style={{ fontSize: c.fsTiny - 1, color: accentColor }}>{edu.year}</p>
            </div>
          ))}
        </div>
      );
    }
    if (id === "summary" && content.summary) {
      return (
        <div key={id} style={{ marginTop: sidebarGap }}>
          <p style={sidebarLabel}>{getSectionLabel("summary", content)}</p>
          <p style={{ fontSize: c.fsTiny - 1, color: "#cbd5e1", lineHeight: 1.5 }}>
            <RichText text={content.summary} accentColor="#93c5fd" />
          </p>
        </div>
      );
    }
    if (id === "experience" && content.experience.length > 0) {
      return (
        <div key={id} style={{ marginTop: sidebarGap }}>
          <p style={sidebarLabel}>{getSectionLabel("experience", content)}</p>
          {content.experience.map((job, i) => (
            <div key={i} style={{ marginBottom: 6, pageBreakInside: "avoid", breakInside: "avoid" }}>
              <p style={{ fontSize: c.fsTiny, fontWeight: 700, color: "#fff" }}>{job.title}</p>
              <p style={{ fontSize: c.fsTiny - 1, fontStyle: "italic", color: "#94a3b8", marginBottom: 2 }}>{job.company}</p>
              {job.bullets.map((b, j) => (
                <div key={j} style={{ display: "flex", gap: 4, marginBottom: 1.5 }}>
                  <span style={{ color: accentColor, flexShrink: 0, fontSize: c.fsTiny - 1 }}>›</span>
                  <span style={{ fontSize: c.fsTiny - 1, color: "#cbd5e1" }}><RichText text={b} accentColor="#93c5fd" /></span>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }
    const custom = content.customSections?.find(s => s.id === id);
    if (custom && custom.items.length > 0) {
      return (
        <div key={id} style={{ marginTop: sidebarGap }}>
          <p style={sidebarLabel}>{getSectionLabel(id, content)}</p>
          {custom.items.map((item, i) => (
            <div key={i} style={{ marginBottom: 5, pageBreakInside: "avoid", breakInside: "avoid" }}>
              <p style={{ fontSize: c.fsTiny, fontWeight: 700, color: "#fff" }}>{item.title}</p>
              {item.subtitle && <p style={{ fontSize: c.fsTiny - 1, color: "#94a3b8" }}>{item.subtitle}</p>}
              {item.bullets.map((b, j) => (
                <div key={j} style={{ display: "flex", gap: 4, marginBottom: 1.5 }}>
                  <span style={{ color: accentColor, flexShrink: 0 }}>›</span>
                  <span style={{ fontSize: c.fsTiny - 1, color: "#cbd5e1" }}><RichText text={b} accentColor="#93c5fd" /></span>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }
    return null;
  }

  const mainHStyle: React.CSSProperties = {
    fontSize: c.fsTiny, fontWeight: 700, color: accentColor, textTransform: "uppercase",
    letterSpacing: 0.8, borderBottom: "0.5px solid #e2e8f0", paddingBottom: 3, marginBottom: c.headerGap,
    pageBreakAfter: "avoid", breakAfter: "avoid",
  };

  const mainSections: Record<string, React.ReactNode> = {
    summary: content.summary ? (
      <div key="summary" style={{ marginBottom: c.secGap }}>
        <p style={mainHStyle}>{getSectionLabel("summary", content)}</p>
        <p style={{ fontSize: c.fsSmall, color: "#374151", lineHeight: 1.5 }}><RichText text={content.summary} accentColor={accentColor} /></p>
      </div>
    ) : null,
    experience: content.experience.length > 0 ? (
      <div key="experience" style={{ marginBottom: c.secGap }}>
        <p style={mainHStyle}>{getSectionLabel("experience", content)}</p>
        {content.experience.map((job, i) => (
          <div key={i} style={{ marginBottom: c.jobGap, pageBreakInside: "avoid", breakInside: "avoid" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 1 }}>
              <span style={{ fontWeight: 700, fontSize: c.fs + 0.5 }}>{job.title}</span>
              <span style={{ fontSize: c.fsTiny, color: "#9ca3af" }}>{job.duration}</span>
            </div>
            <p style={{ fontSize: c.fsSmall - 0.5, fontStyle: "italic", color: "#6b7280", marginBottom: 3 }}>{job.company}</p>
            {job.bullets.map((b, j) => (
              <div key={j} style={{ display: "flex", gap: 4, marginBottom: c.bulletGap, paddingLeft: 3 }}>
                <span style={{ color: accentColor, flexShrink: 0, fontSize: c.fs }}>›</span>
                <span style={{ fontSize: c.fsSmall, color: "#374151", lineHeight: 1.4 }}><RichText text={b} accentColor={accentColor} /></span>
              </div>
            ))}
          </div>
        ))}
      </div>
    ) : null,
    education: content.education.length > 0 ? (
      <div key="education" style={{ marginBottom: c.secGap }}>
        <p style={mainHStyle}>{getSectionLabel("education", content)}</p>
        {content.education.map((edu, i) => (
          <div key={i} style={{ marginBottom: c.jobGap * 0.4, pageBreakInside: "avoid", breakInside: "avoid" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: c.fs }}>{edu.degree}</span>
              <span style={{ fontSize: c.fsTiny, color: "#9ca3af" }}>{edu.year}</span>
            </div>
            <p style={{ fontSize: c.fsSmall - 0.5, fontStyle: "italic", color: "#6b7280" }}>{edu.institution}</p>
          </div>
        ))}
      </div>
    ) : null,
    skills: content.skills.length > 0 ? (
      <div key="skills" style={{ marginBottom: c.secGap }}>
        <p style={mainHStyle}>{getSectionLabel("skills", content)}</p>
        <p style={{ fontSize: c.fsSmall, color: "#374151" }}>{content.skills.join("   ·   ")}</p>
      </div>
    ) : null,
  };

  return (
    <div style={{ fontFamily: ff, display: "flex", fontSize: c.fs, color: "#1f2937", minHeight: 842 }}>
      {/* Sidebar */}
      <div style={{ width: c.sidebarW, backgroundColor: "#1e293b", padding: `${c.padV}px ${Math.round(c.padH * 0.27)}px`, flexShrink: 0 }}>
        <p style={{ fontSize: c.fs + 2, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{content.name || "Your Name"}</p>
        {content.experience[0] && getCol("experience") === "main" && (
          <p style={{ fontSize: c.fsTiny, color: "#94a3b8", marginBottom: c.headerGap + 4 }}>{content.experience[0].title}</p>
        )}
        <p style={{ fontSize: c.fsTiny - 1, fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 }}>Contact</p>
        {contactItems(content.contact).map((item, i) => {
          const { display, href } = resolveContact(item);
          return href
            ? <a key={i} href={href} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: c.fsTiny - 1, color: "#93c5fd", textDecoration: "none", marginBottom: 2 }}>{display}</a>
            : <p key={i} style={{ fontSize: c.fsTiny - 1, color: "#cbd5e1", marginBottom: 2 }}>{display}</p>;
        })}
        {sidebarOrder.map(id => renderSidebarSection(id))}
      </div>
      {/* Main */}
      <div style={{ flex: 1, padding: `${c.padV}px ${Math.round(c.padH * 0.43)}px ${c.padV}px ${Math.round(c.padH * 0.36)}px`, minWidth: 0, textAlign: "justify" }}>
        {mainOrder.map(id => id in mainSections ? (mainSections[id] ?? null) : renderCustom(id, content, accentColor, mainHStyle, { fontWeight: 700, fontSize: c.fs + 0.5 }, { fontSize: c.fsTiny, color: "#9ca3af" }, { fontSize: c.fsSmall, color: "#374151", lineHeight: 1.4 }, "›", c.jobGap, c.bulletGap))}
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export function ResumeHTMLPreview(props: PreviewProps) {
  switch (props.templateId) {
    case "modern":    return <ModernPreview {...props} />;
    case "minimal":   return <MinimalPreview {...props} />;
    case "ats":       return <ATSPreview {...props} />;
    case "executive": return <ExecutivePreview {...props} />;
    default:          return <ClassicPreview {...props} />;
  }
}
