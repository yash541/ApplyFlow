import { Document, Page, Text, View, Link } from "@react-pdf/renderer";
import {
  fontFamily, fontItalic, makeConfig, DEFAULT_SECTION_ORDER,
  getSectionLabel, flattenSkills, autoGroupSkills, type TemplateProps,
} from "./shared";
import { RichText } from "./RichText";

// ── Jake's Resume ─────────────────────────────────────────────────────────────
// Faithful recreation of Jake Gutierrez's Overleaf template.
//
// Exact visual rules (from reference PDF):
//  • Name:        large centered bold serif ~26pt
//  • Contact:     centered, pipe-separated  phone | email | linkedin | github
//  • Section hdr: ALL-CAPS (small-caps sim), NO color, full-width black rule below
//  • Education:   Institution bold (L) + Year (R) on row 1
//                 Degree italic (L) on row 2
//  • Experience:  Title bold (L) + Duration (R) on row 1
//                 Company italic (L) on row 2
//  • Projects:    **Name** | *Tech* (L)  +  Date (R) — one row
//  • Skills:      **Category**: item, item, item  — grouped plain text rows
//  • Colour:      pure black everywhere; accentColor unused (pure B&W)
// ─────────────────────────────────────────────────────────────────────────────

export function JakesTemplate({
  content, accentColor, fontStyle, compact, layout = {}, sectionOrder = DEFAULT_SECTION_ORDER,
}: TemplateProps) {
  const ff = (bold = false) => fontFamily(fontStyle, bold);
  const fi = () => fontItalic(fontStyle);
  const c  = makeConfig(compact, layout);

  // Tighter spacing — Jake's is intentionally dense
  const bulletGap = Math.min(c.bulletGap, 1.5);
  const jobGap    = Math.min(c.jobGap, 6);
  const secGap    = Math.min(c.secGap, 10);

  // Section header: ALL-CAPS, same weight as body, with a full-width black rule
  // Simulates LaTeX \textsc{} (small-caps) effect
  const sectionHeaderText = {
    fontFamily: ff(false),          // NOT bold — matches original small-caps weight
    fontSize: c.fs,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    color: "#000",
  };
  const fullWidthRule = {
    borderBottomWidth: 0.75,
    borderBottomColor: "#000",
    marginTop: 1,
    marginBottom: c.headerGap + 2,
  };

  // Contact parts for pipe-separated header line
  const contactParts = [
    content.contact.phone,
    content.contact.email,
    content.contact.linkedin,
    content.contact.github,
    content.contact.website,
    content.contact.location,
  ].filter((v): v is string => !!v?.trim());

  // ── Helper: render section header (header text + full-width rule) ────────
  // Always used as the FIRST item inside wrap={false} so header never orphans.
  function SectionRule({ id }: { id: string }) {
    return (
      <>
        <Text style={sectionHeaderText}>{getSectionLabel(id, content)}</Text>
        <View style={fullWidthRule} />
      </>
    );
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  const sections: Record<string, React.ReactNode> = {

    education: content.education.length > 0 && (
      <View key="education" style={{ marginBottom: secGap }}>
        {content.education.map((edu, i) => (
          <View key={i} wrap={false} style={{ marginBottom: i < content.education.length - 1 ? jobGap : 0 }}>
            {i === 0 && <SectionRule id="education" />}
            {/* Row 1: Institution (bold L) + Year (R) */}
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                {edu.institution}
              </Text>
              <Text style={{ fontSize: c.fs, color: "#000", flexShrink: 0 }}>{edu.year}</Text>
            </View>
            {/* Row 2: Degree (italic L) */}
            <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#000" }}>{edu.degree}</Text>
          </View>
        ))}
      </View>
    ),

    experience: content.experience.length > 0 && (
      <View key="experience" style={{ marginBottom: secGap }}>
        {content.experience.map((job, i) => (
          <View key={i} wrap={false} style={{ marginBottom: i < content.experience.length - 1 ? jobGap : 0 }}>
            {i === 0 && <SectionRule id="experience" />}
            {/* Row 1: Title (bold L) + Duration (R) */}
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                {job.title}
              </Text>
              <Text style={{ fontSize: c.fs, color: "#000", flexShrink: 0 }}>{job.duration}</Text>
            </View>
            {/* Row 2: Company (italic L) */}
            <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#000", marginBottom: 2 }}>
              {job.company}
            </Text>
            {job.bullets.map((b, j) => (
              <View key={j} style={{ flexDirection: "row", marginBottom: bulletGap }}>
                <Text style={{ fontSize: c.fs, color: "#000", width: 12, flexShrink: 0 }}>•</Text>
                <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#000", minWidth: 0 }} accentColor="#000">
                  {b}
                </RichText>
              </View>
            ))}
          </View>
        ))}
      </View>
    ),

    summary: !!content.summary && (
      <View wrap={false} key="summary" style={{ marginBottom: secGap }}>
        <SectionRule id="summary" />
        <RichText style={{ fontSize: c.fsSmall, color: "#000" }} accentColor="#000">
          {content.summary}
        </RichText>
      </View>
    ),

    projects: (content.projects?.length ?? 0) > 0 && (
      <View key="projects" style={{ marginBottom: secGap }}>
        {content.projects!.map((proj, i) => (
          <View key={i} wrap={false} style={{ marginBottom: i < content.projects!.length - 1 ? jobGap : 0 }}>
            {i === 0 && <SectionRule id="projects" />}
            {/* Row 1: **Name** | *Tech stack*  (L)  +  Date (R) */}
            <View style={{ flexDirection: "row", marginBottom: 2 }}>
              <Text style={{ flex: 1, fontSize: c.fs, color: "#000", minWidth: 0 }}>
                <Text style={{ fontFamily: ff(true) }}>{proj.name}</Text>
                {proj.tech && proj.tech.length > 0 && (
                  <Text style={{ fontFamily: fi() }}>{" | "}{proj.tech.join(", ")}</Text>
                )}
              </Text>
              <Text style={{ fontSize: c.fs, color: "#000", flexShrink: 0 }}>
                {proj.url || proj.github ? (
                  <Link src={proj.url || proj.github || ""} style={{ textDecoration: "none", color: "#000" }}>
                    {proj.url || proj.github}
                  </Link>
                ) : ""}
              </Text>
            </View>
            {proj.description && (
              <RichText style={{ fontSize: c.fsSmall, color: "#000", marginBottom: 2 }} accentColor="#000">
                {proj.description}
              </RichText>
            )}
            {proj.bullets.map((b, j) => (
              <View key={j} style={{ flexDirection: "row", marginBottom: bulletGap }}>
                <Text style={{ fontSize: c.fs, color: "#000", width: 12, flexShrink: 0 }}>•</Text>
                <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#000", minWidth: 0 }} accentColor="#000">
                  {b}
                </RichText>
              </View>
            ))}
          </View>
        ))}
      </View>
    ),

    // Skills: **Category**: item, item, item  — plain text rows, no badges
    skills: flattenSkills(content).length > 0 && (() => {
      const groups = content.skillGroups ?? autoGroupSkills(content.skills);
      return (
        <View wrap={false} key="skills" style={{ marginBottom: secGap }}>
          <SectionRule id="skills" />
          {groups.map((grp, gi) => (
            <View key={gi} style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: compact ? 1.5 : 2 }}>
              {grp.label ? (
                <Text style={{ fontFamily: ff(true), fontSize: c.fsSmall, color: "#000" }}>
                  {grp.label}:{" "}
                </Text>
              ) : null}
              <Text style={{ fontSize: c.fsSmall, color: "#000", flex: 1 }}>
                {grp.items.join(", ")}
              </Text>
            </View>
          ))}
        </View>
      );
    })(),

    certifications: (content.certifications?.length ?? 0) > 0 && (
      <View key="certifications" style={{ marginBottom: secGap }}>
        {content.certifications!.map((cert, i) => (
          <View key={i} wrap={false} style={{ marginBottom: i < content.certifications!.length - 1 ? 4 : 0 }}>
            {i === 0 && <SectionRule id="certifications" />}
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                {cert.name}
              </Text>
              {cert.date && (
                <Text style={{ fontSize: c.fs, color: "#000", flexShrink: 0 }}>{cert.date}</Text>
              )}
            </View>
            <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#000" }}>
              {cert.issuer}{cert.credentialId ? `  ·  ID: ${cert.credentialId}` : ""}
            </Text>
          </View>
        ))}
      </View>
    ),
  };

  // ── Custom section renderer ───────────────────────────────────────────────
  function renderCustomSection(id: string) {
    const custom = content.customSections?.find(s => s.id === id);
    if (!custom || custom.items.length === 0) return null;
    return (
      <View key={id} style={{ marginBottom: secGap }}>
        {custom.items.map((item, idx) => (
          <View key={idx} wrap={false} style={{ marginBottom: idx < custom.items.length - 1 ? jobGap : 0 }}>
            {idx === 0 && <SectionRule id={id} />}
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                {item.title}
              </Text>
              {item.subtitle && (
                <Text style={{ fontSize: c.fs, color: "#000", flexShrink: 0 }}>{item.subtitle}</Text>
              )}
            </View>
            {item.bullets.map((b, j) => (
              <View key={j} style={{ flexDirection: "row", marginBottom: bulletGap }}>
                <Text style={{ fontSize: c.fs, color: "#000", width: 12, flexShrink: 0 }}>•</Text>
                <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#000", minWidth: 0 }} accentColor="#000">
                  {b}
                </RichText>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <Document>
      <Page size="A4" style={{ padding: c.pagePad, fontFamily: ff(), fontSize: c.fs, color: "#000" }}>

        {/* ── Name ─────────────────────────────────────────────────────────── */}
        <Text style={{
          fontSize: compact ? 22 : 26,
          fontFamily: ff(true),
          textAlign: "center",
          color: "#000",
          marginBottom: compact ? 3 : 4,
        }}>
          {content.name || "Your Name"}
        </Text>

        {/* ── Contact: phone | email | linkedin | github ────────────────────── */}
        {contactParts.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginBottom: secGap + 2 }}>
            {contactParts.map((part, i) => (
              <Text key={i} style={{ fontSize: c.fsTiny, color: "#000" }}>
                {i > 0 ? " | " : ""}{part}
              </Text>
            ))}
          </View>
        )}

        {/* ── Sections in user-defined order ───────────────────────────────── */}
        {sectionOrder.map(id => {
          if (id in sections) return sections[id] || null;
          return renderCustomSection(id);
        })}

      </Page>
    </Document>
  );
}
