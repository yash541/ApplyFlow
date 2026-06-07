import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import {
  fontFamily, fontItalic, makeConfig, DEFAULT_SECTION_ORDER,
  getSectionLabel, flattenSkills, type TemplateProps,
} from "./shared";
import { RichText } from "./RichText";

// ── PhotoCV Template ──────────────────────────────────────────────────────────
// Layout: full-width accent-colored HEADER BAND (photo + name + contact)
//         followed by single-column body content.
//
// This is architecturally distinct from the Sidebar template:
//   Sidebar → two-column (dark left strip + white right)
//   PhotoCV → one-column body with a colored TOP BAND
//
// Core functionality unchanged: sectionOrder, wrap={false}, compact, layout,
// projects, certifications, custom sections all work identically.
// ─────────────────────────────────────────────────────────────────────────────

export function PhotoCVTemplate({
  content, accentColor, fontStyle, compact, layout = {}, sectionOrder = DEFAULT_SECTION_ORDER,
}: TemplateProps) {
  const ff = (bold = false) => fontFamily(fontStyle, bold);
  const fi = () => fontItalic(fontStyle);
  const c  = makeConfig(compact, layout);

  // Name split: first word bold-heavy, rest regular — both uppercase
  const nameParts = (content.name || "Your Name").split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName  = nameParts.slice(1).join(" ");

  // Photo size inside the banner
  const PHOTO_SIZE = compact ? 64 : 80;

  // Body horizontal padding (matches page content)
  const bodyPadH = compact ? 28 : 36;
  const bodyPadV = compact ? 14 : 20;

  // Banner padding
  const bannerPadH = compact ? 28 : 36;
  const bannerPadV = compact ? 16 : 22;

  // Contact items for banner — no Unicode icons (Helvetica/Times can't render them)
  // Use plain text labels instead
  const contactItems = [
    content.contact.phone    && { label: "T:", text: content.contact.phone },
    content.contact.email    && { label: "E:", text: content.contact.email },
    content.contact.location && { label: "",   text: content.contact.location },
    content.contact.linkedin && { label: "",   text: content.contact.linkedin },
    content.contact.github   && { label: "",   text: content.contact.github },
    content.contact.website  && { label: "",   text: content.contact.website },
  ].filter(Boolean) as { label: string; text: string }[];

  // ── Section header: accent text + full-width thin rule ───────────────────
  function SectionHeader({ id }: { id: string }) {
    return (
      <View style={{ marginBottom: c.headerGap + 2 }}>
        <Text style={{
          fontFamily: ff(true),
          fontSize: c.fs + 1,
          textTransform: "uppercase" as const,
          letterSpacing: 0.6,
          color: accentColor,
        }}>
          {getSectionLabel(id, content)}
        </Text>
        <View style={{ borderBottomWidth: 1, borderBottomColor: accentColor, marginTop: 2, opacity: 0.3 }} />
      </View>
    );
  }

  // ── Bullet row ────────────────────────────────────────────────────────────
  function Bullet({ text }: { text: string }) {
    return (
      <View style={{ flexDirection: "row", marginBottom: c.bulletGap }}>
        <Text style={{ fontSize: c.fs, color: accentColor, width: 12, flexShrink: 0 }}>•</Text>
        <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#222", minWidth: 0 }} accentColor={accentColor}>
          {text}
        </RichText>
      </View>
    );
  }

  // ── Section renderers (same logic, single-column) ─────────────────────────

  const sections: Record<string, React.ReactNode> = {

    summary: !!content.summary && (
      <View wrap={false} key="summary" style={{ marginBottom: c.secGap }}>
        <SectionHeader id="summary" />
        <RichText style={{ fontSize: c.fsSmall, color: "#333", textAlign: "justify" }} accentColor={accentColor}>
          {content.summary}
        </RichText>
      </View>
    ),

    experience: content.experience.length > 0 && (
      <View key="experience" style={{ marginBottom: c.secGap }}>
        {content.experience.map((job, i) => (
          <View key={i} wrap={false} style={{ marginBottom: i < content.experience.length - 1 ? c.jobGap : 0 }}>
            {i === 0 && <SectionHeader id="experience" />}
            {/* Company (bold L) + Duration (R) */}
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#111", minWidth: 0 }}>
                {job.company}
              </Text>
              <Text style={{ fontSize: c.fsTiny, color: "#666", flexShrink: 0 }}>
                {job.duration}
              </Text>
            </View>
            {/* Title italic */}
            <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#555", marginBottom: 3 }}>
              {job.title}
            </Text>
            {job.bullets.map((b, j) => <Bullet key={j} text={b} />)}
          </View>
        ))}
      </View>
    ),

    education: content.education.length > 0 && (
      <View key="education" style={{ marginBottom: c.secGap }}>
        {content.education.map((edu, i) => (
          <View key={i} wrap={false} style={{ marginBottom: i < content.education.length - 1 ? c.jobGap * 0.6 : 0 }}>
            {i === 0 && <SectionHeader id="education" />}
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#111", minWidth: 0 }}>
                {edu.degree}
              </Text>
              <Text style={{ fontSize: c.fsTiny, color: "#666", flexShrink: 0 }}>{edu.year}</Text>
            </View>
            <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#555" }}>{edu.institution}</Text>
          </View>
        ))}
      </View>
    ),

    skills: flattenSkills(content).length > 0 && (() => {
      const skills = flattenSkills(content);
      const colSize = Math.ceil(skills.length / 3);
      const columns = [
        skills.slice(0, colSize),
        skills.slice(colSize, colSize * 2),
        skills.slice(colSize * 2),
      ].filter(col => col.length > 0);
      return (
        <View wrap={false} key="skills" style={{ marginBottom: c.secGap }}>
          <SectionHeader id="skills" />
          <View style={{ flexDirection: "row" }}>
            {columns.map((col, ci) => (
              <View key={ci} style={{ flex: 1, paddingRight: ci < columns.length - 1 ? 8 : 0 }}>
                {col.map((skill, si) => (
                  <View key={si} style={{ flexDirection: "row", marginBottom: compact ? 1.5 : 2.5 }}>
                    <Text style={{ fontSize: c.fs, color: accentColor, width: 12, flexShrink: 0 }}>•</Text>
                    <Text style={{ flex: 1, fontSize: c.fsSmall, color: "#222" }}>{skill}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      );
    })(),

    projects: (content.projects?.length ?? 0) > 0 && (
      <View key="projects" style={{ marginBottom: c.secGap }}>
        {content.projects!.map((proj, i) => (
          <View key={i} wrap={false} style={{ marginBottom: i < content.projects!.length - 1 ? c.jobGap : 0 }}>
            {i === 0 && <SectionHeader id="projects" />}
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#111", minWidth: 0 }}>
                {proj.name}
                {proj.tech && proj.tech.length > 0
                  ? <Text style={{ fontFamily: ff(false), fontSize: c.fsTiny, color: "#666" }}>{" · "}{proj.tech.join(", ")}</Text>
                  : null}
              </Text>
            </View>
            {proj.description && (
              <RichText style={{ fontSize: c.fsSmall, color: "#444", marginBottom: 2 }} accentColor={accentColor}>
                {proj.description}
              </RichText>
            )}
            {proj.bullets.map((b, j) => <Bullet key={j} text={b} />)}
          </View>
        ))}
      </View>
    ),

    certifications: (content.certifications?.length ?? 0) > 0 && (
      <View key="certifications" style={{ marginBottom: c.secGap }}>
        {content.certifications!.map((cert, i) => (
          <View key={i} wrap={false} style={{ marginBottom: i < content.certifications!.length - 1 ? 5 : 0 }}>
            {i === 0 && <SectionHeader id="certifications" />}
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#111", minWidth: 0 }}>
                {cert.name}
              </Text>
              {cert.date && <Text style={{ fontSize: c.fsTiny, color: "#666", flexShrink: 0 }}>{cert.date}</Text>}
            </View>
            <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#555" }}>
              {cert.issuer}{cert.credentialId ? `  ·  ID: ${cert.credentialId}` : ""}
            </Text>
          </View>
        ))}
      </View>
    ),
  };

  // ── Page ──────────────────────────────────────────────────────────────────

  return (
    <Document>
      {/* Page paddingTop re-applies on every page so body content has top margin on page 2+.
          The header banner uses marginTop: -bodyPadV to cancel it on page 1 only. */}
      <Page size="A4" style={{ fontFamily: ff(), fontSize: c.fs, color: "#000", paddingTop: bodyPadV, paddingBottom: bodyPadV }}>

        {/* ── Header Banner — negative marginTop cancels the Page paddingTop on page 1 */}
        <View style={{
          backgroundColor: accentColor,
          marginTop: -bodyPadV,
          marginLeft: 0,
          marginRight: 0,
          paddingTop: bannerPadV + bodyPadV,
          paddingBottom: bannerPadV,
          paddingLeft: bannerPadH,
          paddingRight: bannerPadH,
          flexDirection: "row",
          alignItems: "center",
        }}>
          {/* Circular photo (if available) */}
          {content.photo && (
            <View style={{
              width: PHOTO_SIZE + 4,
              height: PHOTO_SIZE + 4,
              borderRadius: (PHOTO_SIZE + 4) / 2,
              borderWidth: 2,
              borderColor: "rgba(255,255,255,0.5)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: compact ? 14 : 18,
              flexShrink: 0,
            }}>
              <Image
                src={content.photo}
                style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2 }}
              />
            </View>
          )}

          {/* Name + title */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: compact ? 18 : 24, color: "#fff", letterSpacing: -0.3, marginBottom: 2 }}>
              <Text style={{ fontFamily: ff(true) }}>{firstName.toUpperCase()} </Text>
              <Text style={{ fontFamily: ff(false) }}>{lastName.toUpperCase()}</Text>
            </Text>
            {content.experience[0]?.title && (
              <Text style={{ fontSize: c.fsSmall, color: "rgba(255,255,255,0.80)", letterSpacing: 0.5 }}>
                {content.experience[0].title.toUpperCase()}
              </Text>
            )}
            {/* Short white underline bar */}
            <View style={{ width: 36, height: 2, backgroundColor: "rgba(255,255,255,0.45)", marginTop: compact ? 5 : 7 }} />
          </View>

          {/* Contact items (right side of banner) */}
          {contactItems.length > 0 && (
            <View style={{ alignItems: "flex-end", flexShrink: 0, marginLeft: 12 }}>
              {contactItems.slice(0, 5).map((item, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: compact ? 2 : 3 }}>
                  {item.label ? (
                    <Text style={{ fontSize: c.fsTiny, color: "rgba(255,255,255,0.60)", marginRight: 3, fontFamily: ff(true) }}>
                      {item.label}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: c.fsTiny, color: "rgba(255,255,255,0.90)" }}>
                    {item.text}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Body (single column, padded) ─────────────────────────────── */}
        <View style={{ paddingLeft: bodyPadH, paddingRight: bodyPadH, paddingBottom: bodyPadV }}>
          {sectionOrder.map(id => {
            if (id in sections) return sections[id] || null;
            const custom = content.customSections?.find(s => s.id === id);
            if (!custom || custom.items.length === 0) return null;
            return (
              <View key={id} style={{ marginBottom: c.secGap }}>
                {custom.items.map((item, idx) => (
                  <View key={idx} wrap={false} style={{ marginBottom: idx < custom.items.length - 1 ? c.jobGap : 0 }}>
                    {idx === 0 && <SectionHeader id={id} />}
                    <View style={{ flexDirection: "row", marginBottom: 1 }}>
                      <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#111", minWidth: 0 }}>
                        {item.title}
                      </Text>
                      {item.subtitle && (
                        <Text style={{ fontSize: c.fsTiny, color: "#666", flexShrink: 0 }}>{item.subtitle}</Text>
                      )}
                    </View>
                    {item.bullets.map((b, j) => <Bullet key={j} text={b} />)}
                  </View>
                ))}
              </View>
            );
          })}
        </View>

      </Page>
    </Document>
  );
}
