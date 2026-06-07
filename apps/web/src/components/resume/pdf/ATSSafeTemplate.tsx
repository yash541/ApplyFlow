import { Document, Page, Text, View, Link } from "@react-pdf/renderer";
import {
  fontFamily, fontItalic, makeConfig, DEFAULT_SECTION_ORDER,
  getSectionLabel, autoGroupSkills, flattenSkills, type TemplateProps,
} from "./shared";
import { RichText } from "./RichText";

// ── ATS-Ready Template (redesigned) ──────────────────────────────────────────
// Visual rules (matches reference image):
//  • Name + title on ONE centered line  "Christopher Carter, Accountant"
//  • Contact: pipe-separated, centered, plain black
//  • Two-column page layout:
//      Left column (~110pt): section label (ALL CAPS, small, bold)
//      Right column (flex:1): section content
//  • Full-width 0.5pt rule ABOVE each section (not below)
//  • Within content column: date sub-column (~85pt) + entry sub-column (flex:1)
//  • Bullets: plain black •
//  • Skills: two-column bullet grid
//  • Pure black — no accent color anywhere
//
// Core functionality unchanged: sectionOrder, wrap={false}, compact, layout,
// projects, certifications, custom sections all work identically.
// ─────────────────────────────────────────────────────────────────────────────

export function ATSSafeTemplate({
  content, accentColor, fontStyle, compact, layout = {}, sectionOrder = DEFAULT_SECTION_ORDER,
}: TemplateProps) {
  const ff  = (bold = false) => fontFamily(fontStyle, bold);
  const fi  = () => fontItalic(fontStyle);
  const c   = makeConfig(compact, layout);

  // Left label column width & date sub-column width
  const LABEL_W = compact ? 88 : 108;
  const DATE_W  = compact ? 72 : 88;

  // Shared styles
  const labelStyle = {
    fontFamily: ff(true),
    fontSize: c.fsTiny + 0.5,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    color: "#000",
  };
  const sectionRule = {
    borderBottomWidth: 0.5,
    borderBottomColor: "#999",
    marginBottom: compact ? 5 : 7,
  };

  // Full bullet row
  function Bullet({ text }: { text: string }) {
    return (
      <View style={{ flexDirection: "row", marginBottom: c.bulletGap }}>
        <Text style={{ fontSize: c.fs, color: "#000", width: 12, flexShrink: 0 }}>•</Text>
        <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#111", minWidth: 0 }} accentColor="#000">
          {text}
        </RichText>
      </View>
    );
  }

  // Contact parts (pipe-separated, plain black)
  const contactParts = [
    content.contact.email,
    content.contact.phone,
    content.contact.location,
    content.contact.linkedin,
    content.contact.github,
    content.contact.website,
  ].filter((v): v is string => !!v?.trim());

  // ── Section definitions ───────────────────────────────────────────────────

  const sections: Record<string, React.ReactNode> = {

    summary: !!content.summary && (
      <View key="summary" style={{ marginBottom: c.secGap }}>
        <View style={sectionRule} />
        <View style={{ flexDirection: "row" }}>
          {/* Label */}
          <View style={{ width: LABEL_W, flexShrink: 0, paddingRight: 8 }}>
            <Text style={labelStyle}>{getSectionLabel("summary", content)}</Text>
          </View>
          {/* Content */}
          <View wrap={false} style={{ flex: 1, minWidth: 0 }}>
            <RichText style={{ fontSize: c.fsSmall, color: "#111", textAlign: "justify" }} accentColor="#000">
              {content.summary}
            </RichText>
          </View>
        </View>
      </View>
    ),

    experience: content.experience.length > 0 && (
      <View key="experience" style={{ marginBottom: c.secGap }}>
        <View style={sectionRule} />
        <View style={{ flexDirection: "row" }}>
          {/* Label — only on first row */}
          <View style={{ width: LABEL_W, flexShrink: 0, paddingRight: 8 }}>
            <Text style={labelStyle}>{getSectionLabel("experience", content)}</Text>
          </View>
          {/* All entries stacked in right column */}
          <View style={{ flex: 1, minWidth: 0 }}>
            {content.experience.map((job, i) => (
              <View key={i} wrap={false} style={{ marginBottom: i < content.experience.length - 1 ? c.jobGap : 0 }}>
                {/* Date (L) + Title, Company (R) */}
                <View style={{ flexDirection: "row", marginBottom: compact ? 1 : 2 }}>
                  <Text style={{ width: DATE_W, flexShrink: 0, fontSize: c.fsTiny, color: "#555" }}>
                    {job.duration}
                  </Text>
                  <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                    {job.title}{job.company ? `, ${job.company}` : ""}
                  </Text>
                </View>
                {/* Bullets indented to align with title */}
                <View style={{ paddingLeft: DATE_W }}>
                  {job.bullets.map((b, j) => <Bullet key={j} text={b} />)}
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    ),

    education: content.education.length > 0 && (
      <View key="education" style={{ marginBottom: c.secGap }}>
        <View style={sectionRule} />
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: LABEL_W, flexShrink: 0, paddingRight: 8 }}>
            <Text style={labelStyle}>{getSectionLabel("education", content)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {content.education.map((edu, i) => (
              <View key={i} wrap={false} style={{ marginBottom: i < content.education.length - 1 ? c.jobGap : 0 }}>
                <View style={{ flexDirection: "row", marginBottom: 1 }}>
                  <Text style={{ width: DATE_W, flexShrink: 0, fontSize: c.fsTiny, color: "#555" }}>
                    {edu.year}
                  </Text>
                  <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                    {edu.degree}{edu.institution ? `, ${edu.institution}` : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    ),

    // Skills: two-column bullet grid
    skills: flattenSkills(content).length > 0 && (() => {
      const skills = flattenSkills(content);
      const colSize = Math.ceil(skills.length / 2);
      const col1 = skills.slice(0, colSize);
      const col2 = skills.slice(colSize);
      return (
        <View key="skills" style={{ marginBottom: c.secGap }}>
          <View style={sectionRule} />
          <View style={{ flexDirection: "row" }}>
            <View style={{ width: LABEL_W, flexShrink: 0, paddingRight: 8 }}>
              <Text style={labelStyle}>{getSectionLabel("skills", content)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View wrap={false} style={{ flexDirection: "row" }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  {col1.map((s, i) => (
                    <View key={i} style={{ flexDirection: "row", marginBottom: compact ? 1.5 : 2.5 }}>
                      <Text style={{ fontSize: c.fs, color: "#000", width: 10, flexShrink: 0 }}>•</Text>
                      <Text style={{ flex: 1, fontSize: c.fsSmall, color: "#111" }}>{s}</Text>
                    </View>
                  ))}
                </View>
                {col2.length > 0 && (
                  <View style={{ flex: 1 }}>
                    {col2.map((s, i) => (
                      <View key={i} style={{ flexDirection: "row", marginBottom: compact ? 1.5 : 2.5 }}>
                        <Text style={{ fontSize: c.fs, color: "#000", width: 10, flexShrink: 0 }}>•</Text>
                        <Text style={{ flex: 1, fontSize: c.fsSmall, color: "#111" }}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      );
    })(),

    projects: (content.projects?.length ?? 0) > 0 && (
      <View key="projects" style={{ marginBottom: c.secGap }}>
        <View style={sectionRule} />
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: LABEL_W, flexShrink: 0, paddingRight: 8 }}>
            <Text style={labelStyle}>{getSectionLabel("projects", content)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {content.projects!.map((proj, i) => (
              <View key={i} wrap={false} style={{ marginBottom: i < content.projects!.length - 1 ? c.jobGap : 0 }}>
                <View style={{ flexDirection: "row", marginBottom: 1 }}>
                  <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                    {proj.name}
                    {proj.tech && proj.tech.length > 0
                      ? <Text style={{ fontFamily: ff(false), fontSize: c.fsTiny, color: "#555" }}>{" | "}{proj.tech.join(", ")}</Text>
                      : null}
                  </Text>
                  {(proj.url || proj.github) && (
                    <Link src={proj.url || proj.github || ""} style={{ textDecoration: "none", flexShrink: 0 }}>
                      <Text style={{ fontSize: c.fsTiny, color: "#333" }}>↗</Text>
                    </Link>
                  )}
                </View>
                {proj.description && (
                  <RichText style={{ fontSize: c.fsSmall, color: "#333", marginBottom: 2 }} accentColor="#000">
                    {proj.description}
                  </RichText>
                )}
                {proj.bullets.map((b, j) => <Bullet key={j} text={b} />)}
              </View>
            ))}
          </View>
        </View>
      </View>
    ),

    certifications: (content.certifications?.length ?? 0) > 0 && (
      <View key="certifications" style={{ marginBottom: c.secGap }}>
        <View style={sectionRule} />
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: LABEL_W, flexShrink: 0, paddingRight: 8 }}>
            <Text style={labelStyle}>{getSectionLabel("certifications", content)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {content.certifications!.map((cert, i) => (
              <View key={i} wrap={false} style={{ marginBottom: i < content.certifications!.length - 1 ? compact ? 3 : 5 : 0 }}>
                <View style={{ flexDirection: "row", marginBottom: 1 }}>
                  <Text style={{ width: DATE_W, flexShrink: 0, fontSize: c.fsTiny, color: "#555" }}>
                    {cert.date ?? ""}
                  </Text>
                  <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                    {cert.name}
                  </Text>
                </View>
                <View style={{ paddingLeft: DATE_W }}>
                  <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#333" }}>
                    {cert.issuer}{cert.credentialId ? `  ·  ID: ${cert.credentialId}` : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    ),
  };

  // ── Page ──────────────────────────────────────────────────────────────────

  return (
    <Document>
      <Page size="A4" style={{ padding: c.pagePad, fontFamily: ff(), fontSize: c.fs, color: "#000" }}>

        {/* Name + headline on one line — "Name, Title" centered bold */}
        <Text style={{
          fontSize: compact ? 14 : 16,
          fontFamily: ff(true),
          textAlign: "center",
          color: "#000",
          marginBottom: compact ? 3 : 4,
        }}>
          {content.name || "Your Name"}
          {content.experience[0]?.title ? `, ${content.experience[0].title}` : ""}
        </Text>

        {/* Contact — centered, pipe-separated, plain black */}
        {contactParts.length > 0 && (
          <View style={{
            flexDirection: "row", flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: compact ? c.secGap : c.secGap + 4,
          }}>
            {contactParts.map((part, i) => (
              <Text key={i} style={{ fontSize: c.fsTiny, color: "#444" }}>
                {i > 0 ? "  |  " : ""}{part}
              </Text>
            ))}
          </View>
        )}

        {/* Sections — same ordering and rendering logic, new visual layout */}
        {sectionOrder.map(id => {
          if (id in sections) return sections[id] || null;

          // Custom sections rendered in the same two-column layout
          const custom = content.customSections?.find(s => s.id === id);
          if (!custom || custom.items.length === 0) return null;
          return (
            <View key={id} style={{ marginBottom: c.secGap }}>
              <View style={sectionRule} />
              <View style={{ flexDirection: "row" }}>
                <View style={{ width: LABEL_W, flexShrink: 0, paddingRight: 8 }}>
                  <Text style={labelStyle}>{getSectionLabel(id, content)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  {custom.items.map((item, idx) => (
                    <View key={idx} wrap={false} style={{ marginBottom: idx < custom.items.length - 1 ? c.jobGap : 0 }}>
                      <View style={{ flexDirection: "row", marginBottom: 1 }}>
                        <Text style={{ width: DATE_W, flexShrink: 0, fontSize: c.fsTiny, color: "#555" }}>
                          {item.subtitle ?? ""}
                        </Text>
                        <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                          {item.title}
                        </Text>
                      </View>
                      <View style={{ paddingLeft: DATE_W }}>
                        {item.bullets.map((b, j) => <Bullet key={j} text={b} />)}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          );
        })}

      </Page>
    </Document>
  );
}
