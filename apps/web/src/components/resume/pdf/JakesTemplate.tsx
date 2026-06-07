import { Document, Page, Text, View, Link } from "@react-pdf/renderer";
import {
  fontFamily, fontItalic, makeConfig, DEFAULT_SECTION_ORDER,
  getSectionLabel, flattenSkills, autoGroupSkills, type TemplateProps,
} from "./shared";
import { RichText } from "./RichText";

// ── Jake's Resume ────────────────────────────────────────────────────────────
// Inspired by Jake Gutierrez's widely-used Overleaf template.
// Key visual rules:
//   • Large centered name
//   • Contact line: email | phone | linkedin | github  (pipe-separated)
//   • Section headers: BOLD ALL-CAPS + full-width horizontal rule below
//   • Job entries: title (bold left) + date (right), company (italic)
//   • Bullets: plain black dot, slight indent
//   • Skills: "Category: item, item, item" rows — no pill badges
//   • Pure black/white; accent color only on section-header text
// ─────────────────────────────────────────────────────────────────────────────

export function JakesTemplate({
  content, accentColor, fontStyle, compact, layout = {}, sectionOrder = DEFAULT_SECTION_ORDER,
}: TemplateProps) {
  const ff  = (bold = false) => fontFamily(fontStyle, bold);
  const fi  = () => fontItalic(fontStyle);
  const c   = makeConfig(compact, layout);

  // Slightly tighter line spacing than the global default — Jake's is dense
  const bulletGap = Math.min(c.bulletGap, 2);
  const jobGap    = Math.min(c.jobGap, 7);

  // Header for each section: bold ALL-CAPS text + full-width rule
  const headerText = {
    fontFamily: ff(true),
    fontSize: c.fs + 0.5,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
    color: accentColor,
  };
  const rule = {
    borderBottomWidth: 0.75,
    borderBottomColor: "#111",
    marginTop: 1.5,
    marginBottom: c.headerGap + 1,
  };

  // Build contact string manually for Jake's "|" style separator
  const contactParts = [
    content.contact.email,
    content.contact.phone,
    content.contact.location,
    content.contact.linkedin,
    content.contact.github,
    content.contact.website,
  ].filter((v): v is string => !!v?.trim());

  // ── Section definitions ──────────────────────────────────────────────────

  const sections: Record<string, React.ReactNode> = {

    summary: !!content.summary && (
      <View wrap={false} key="summary" style={{ marginBottom: c.secGap }}>
        <Text style={headerText}>{getSectionLabel("summary", content)}</Text>
        <View style={rule} />
        <RichText style={{ fontSize: c.fsSmall, color: "#111" }} accentColor={accentColor}>
          {content.summary}
        </RichText>
      </View>
    ),

    experience: content.experience.length > 0 && (
      <View key="experience" style={{ marginBottom: c.secGap }}>
        {content.experience.map((job, i) => (
          <View key={i} wrap={false} style={{ marginBottom: i < content.experience.length - 1 ? jobGap : 0 }}>
            {i === 0 && (
              <>
                <Text style={headerText}>{getSectionLabel("experience", content)}</Text>
                <View style={rule} />
              </>
            )}
            {/* Title | Duration */}
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                {job.title}
              </Text>
              <Text style={{ fontSize: c.fsTiny, color: "#333", flexShrink: 0 }}>{job.duration}</Text>
            </View>
            {/* Company */}
            <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#333", marginBottom: 2 }}>
              {job.company}
            </Text>
            {job.bullets.map((b, j) => (
              <View key={j} style={{ flexDirection: "row", marginBottom: bulletGap, paddingLeft: 8 }}>
                <Text style={{ fontSize: c.fs, color: "#111", width: 10, flexShrink: 0 }}>•</Text>
                <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#111", minWidth: 0 }} accentColor={accentColor}>
                  {b}
                </RichText>
              </View>
            ))}
          </View>
        ))}
      </View>
    ),

    education: content.education.length > 0 && (
      <View key="education" style={{ marginBottom: c.secGap }}>
        {content.education.map((edu, i) => (
          <View key={i} wrap={false} style={{ marginBottom: i < content.education.length - 1 ? jobGap : 0 }}>
            {i === 0 && (
              <>
                <Text style={headerText}>{getSectionLabel("education", content)}</Text>
                <View style={rule} />
              </>
            )}
            {/* Institution | Year */}
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                {edu.institution}
              </Text>
              <Text style={{ fontSize: c.fsTiny, color: "#333", flexShrink: 0 }}>{edu.year}</Text>
            </View>
            <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#333" }}>{edu.degree}</Text>
          </View>
        ))}
      </View>
    ),

    projects: (content.projects?.length ?? 0) > 0 && (
      <View key="projects" style={{ marginBottom: c.secGap }}>
        {content.projects!.map((proj, i) => (
          <View key={i} wrap={false} style={{ marginBottom: i < content.projects!.length - 1 ? jobGap : 0 }}>
            {i === 0 && (
              <>
                <Text style={headerText}>{getSectionLabel("projects", content)}</Text>
                <View style={rule} />
              </>
            )}
            {/* Project Name | Tech Stack */}
            <View style={{ flexDirection: "row", marginBottom: 2 }}>
              <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", minWidth: 0 }}>
                <Text style={{ fontFamily: ff(true), fontSize: c.fs, color: "#000" }}>{proj.name}</Text>
                {proj.tech && proj.tech.length > 0 && (
                  <Text style={{ fontFamily: fi(), fontSize: c.fs, color: "#444" }}>
                    {" | "}{proj.tech.join(", ")}
                  </Text>
                )}
              </View>
              {(proj.url || proj.github) && (
                <Link src={proj.url || proj.github || ""} style={{ textDecoration: "none", flexShrink: 0 }}>
                  <Text style={{ fontSize: c.fsTiny, color: accentColor }}>↗</Text>
                </Link>
              )}
            </View>
            {proj.description && (
              <RichText style={{ fontSize: c.fsSmall, color: "#333", marginBottom: 2 }} accentColor={accentColor}>
                {proj.description}
              </RichText>
            )}
            {proj.bullets.map((b, j) => (
              <View key={j} style={{ flexDirection: "row", marginBottom: bulletGap, paddingLeft: 8 }}>
                <Text style={{ fontSize: c.fs, color: "#111", width: 10, flexShrink: 0 }}>•</Text>
                <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#111", minWidth: 0 }} accentColor={accentColor}>
                  {b}
                </RichText>
              </View>
            ))}
          </View>
        ))}
      </View>
    ),

    // Skills: "Category: item, item, item" — no badges, plain text
    skills: flattenSkills(content).length > 0 && (() => {
      const groups = content.skillGroups ?? autoGroupSkills(content.skills);
      return (
        <View wrap={false} key="skills" style={{ marginBottom: c.secGap }}>
          <Text style={headerText}>{getSectionLabel("skills", content)}</Text>
          <View style={rule} />
          {groups.map((grp, gi) => (
            <View key={gi} style={{ flexDirection: "row", marginBottom: compact ? 2 : 3 }}>
              {grp.label ? (
                <Text style={{
                  fontFamily: ff(true), fontSize: c.fsSmall,
                  width: compact ? 88 : 104, flexShrink: 0, color: "#000",
                }}>
                  {grp.label}:
                </Text>
              ) : null}
              <Text style={{ flex: 1, fontSize: c.fsSmall, color: "#111" }}>
                {grp.items.join(", ")}
              </Text>
            </View>
          ))}
        </View>
      );
    })(),

    certifications: (content.certifications?.length ?? 0) > 0 && (
      <View key="certifications" style={{ marginBottom: c.secGap }}>
        {content.certifications!.map((cert, i) => (
          <View key={i} wrap={false} style={{ marginBottom: i < content.certifications!.length - 1 ? 4 : 0 }}>
            {i === 0 && (
              <>
                <Text style={headerText}>{getSectionLabel("certifications", content)}</Text>
                <View style={rule} />
              </>
            )}
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fsSmall, color: "#000", minWidth: 0 }}>
                {cert.name}
              </Text>
              {cert.date && (
                <Text style={{ fontSize: c.fsTiny, color: "#333", flexShrink: 0 }}>{cert.date}</Text>
              )}
            </View>
            <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#333" }}>{cert.issuer}</Text>
            {cert.credentialId && (
              <Text style={{ fontSize: c.fsTiny, color: "#666" }}>ID: {cert.credentialId}</Text>
            )}
          </View>
        ))}
      </View>
    ),
  };

  return (
    <Document>
      <Page size="A4" style={{ padding: c.pagePad, fontFamily: ff(), fontSize: c.fs, color: "#000" }}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <View style={{ alignItems: "center", marginBottom: compact ? 3 : 5 }}>
          <Text style={{ fontSize: compact ? 22 : 28, fontFamily: ff(true), letterSpacing: -0.5, color: "#000" }}>
            {content.name || "Your Name"}
          </Text>
        </View>

        {/* Contact: email | phone | location | linkedin | github */}
        {contactParts.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginBottom: c.secGap }}>
            {contactParts.map((part, i) => (
              <Text key={i} style={{ fontSize: c.fsTiny, color: "#333" }}>
                {i > 0 ? " | " : ""}{part}
              </Text>
            ))}
          </View>
        )}

        {/* ── Sections ─────────────────────────────────────────────────────── */}
        {sectionOrder.map(id => {
          if (id in sections) return sections[id] || null;
          // Custom sections
          const custom = content.customSections?.find(s => s.id === id);
          if (!custom || custom.items.length === 0) return null;
          return (
            <View key={id} style={{ marginBottom: c.secGap }}>
              {custom.items.map((item, itemIdx) => (
                <View key={itemIdx} wrap={false} style={{ marginBottom: itemIdx < custom.items.length - 1 ? jobGap : 0 }}>
                  {itemIdx === 0 && (
                    <>
                      <Text style={headerText}>{getSectionLabel(id, content)}</Text>
                      <View style={rule} />
                    </>
                  )}
                  <View style={{ flexDirection: "row", marginBottom: 1 }}>
                    <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                      {item.title}
                    </Text>
                    {item.subtitle && (
                      <Text style={{ fontSize: c.fsTiny, color: "#333", flexShrink: 0 }}>{item.subtitle}</Text>
                    )}
                  </View>
                  {item.bullets.map((b, bIdx) => (
                    <View key={bIdx} style={{ flexDirection: "row", marginBottom: bulletGap, paddingLeft: 8 }}>
                      <Text style={{ fontSize: c.fs, color: "#111", width: 10, flexShrink: 0 }}>•</Text>
                      <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#111", minWidth: 0 }} accentColor={accentColor}>
                        {b}
                      </RichText>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          );
        })}

      </Page>
    </Document>
  );
}
