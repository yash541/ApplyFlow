import { Document, Page, Text, View, Link } from "@react-pdf/renderer";
import { fontFamily, fontItalic, makeConfig, DEFAULT_SECTION_ORDER, getSectionLabel, flattenSkills, type TemplateProps } from "./shared";
import { RichText } from "./RichText";
import { CustomSectionBlock } from "./CustomSectionBlock";

// ── Classic Template (redesigned) ─────────────────────────────────────────────
// Visual rules (matches reference image):
//  • Name:        ALL-CAPS, large, bold, centered
//  • Headline:    role/title from experience[0], smaller, centered, not bold
//  • Contact:     thin rule → pipe-separated contacts → thin rule (plain black)
//  • Section hdr: filled light-gray band (#e2e8f0), bold ALL-CAPS text, 4pt padding
//  • Experience:  "Title, Company" combined bold (L) + bold date (R) on one row
//  • Education:   Degree bold (L) + Year bold (R), Institution plain below
//  • Skills:      3-column bullet grid (no pill badges)
//  • Colour:      pure black throughout; accent color unused in content
// ─────────────────────────────────────────────────────────────────────────────

export function ClassicTemplate({ content, accentColor, fontStyle, compact, layout = {}, sectionOrder = DEFAULT_SECTION_ORDER }: TemplateProps) {
  const ff = (bold = false) => fontFamily(fontStyle, bold);
  const fi = () => fontItalic(fontStyle);
  const c  = makeConfig(compact, layout);

  // ── Shared styles ──────────────────────────────────────────────────────────

  // Section band: filled background header (the key visual change)
  // Derive a very light tint from the accent color (88% white + 12% accent)
  // so the band reflects the chosen color while staying pastel/subtle
  function hexTint(hex: string, lightness = 0.88): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const tr = Math.round(r + (255 - r) * lightness);
    const tg = Math.round(g + (255 - g) * lightness);
    const tb = Math.round(b + (255 - b) * lightness);
    return `#${tr.toString(16).padStart(2, "0")}${tg.toString(16).padStart(2, "0")}${tb.toString(16).padStart(2, "0")}`;
  }
  const bandColor = hexTint(accentColor.length === 7 ? accentColor : "#2563eb");

  const bandContainer = {
    backgroundColor: bandColor,
    paddingTop: compact ? 3 : 4,
    paddingBottom: compact ? 3 : 4,
    paddingLeft: compact ? 6 : 8,
    marginBottom: c.headerGap + 2,
  };
  const bandText = {
    fontFamily: ff(true),
    fontSize: c.fs,
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
    color: "#000",
  };

  // Shared bullet row (black, not accent-colored)
  function BulletRow({ text }: { text: string }) {
    return (
      <View style={{ flexDirection: "row", marginBottom: c.bulletGap }}>
        <Text style={{ fontSize: c.fs, color: "#000", width: 12, flexShrink: 0 }}>•</Text>
        <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#111", minWidth: 0 }} accentColor="#000">
          {text}
        </RichText>
      </View>
    );
  }

  // Helper: band header + first-item in same wrap={false} block to prevent orphaned header
  function BandHeader({ id }: { id: string }) {
    return (
      <View style={bandContainer}>
        <Text style={bandText}>{getSectionLabel(id, content)}</Text>
      </View>
    );
  }

  // Contact items (pipe-separated, no accent color)
  const contactParts = [
    content.contact.email,
    content.contact.phone,
    content.contact.location,
    content.contact.linkedin,
    content.contact.github,
    content.contact.website,
  ].filter((v): v is string => !!v?.trim());

  // ── Section definitions (same logic as before, new visual presentation) ───

  const sections: Record<string, React.ReactNode> = {

    summary: !!content.summary && (
      <View wrap={false} key="summary" style={{ marginBottom: c.secGap }}>
        <BandHeader id="summary" />
        <RichText style={{ fontSize: c.fsSmall, color: "#111" }} accentColor="#000">
          {content.summary}
        </RichText>
      </View>
    ),

    experience: content.experience.length > 0 && (
      <View key="experience" style={{ marginBottom: c.secGap }}>
        {content.experience.map((job, i) => (
          <View key={i} wrap={false} style={{ marginBottom: i < content.experience.length - 1 ? c.jobGap : 0 }}>
            {i === 0 && <BandHeader id="experience" />}
            {/* Title, Company (combined bold L) + Date (bold R) */}
            <View style={{ flexDirection: "row", marginBottom: compact ? 2 : 3 }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                {job.title}{job.company ? `, ${job.company}` : ""}
              </Text>
              <Text style={{ fontFamily: ff(true), fontSize: c.fs, color: "#000", flexShrink: 0 }}>
                {job.duration}
              </Text>
            </View>
            {job.bullets.map((b, j) => <BulletRow key={j} text={b} />)}
          </View>
        ))}
      </View>
    ),

    education: content.education.length > 0 && (
      <View key="education" style={{ marginBottom: c.secGap }}>
        {content.education.map((edu, i) => (
          <View key={i} wrap={false} style={{ marginBottom: i < content.education.length - 1 ? c.jobGap : 0 }}>
            {i === 0 && <BandHeader id="education" />}
            {/* Degree (bold L) + Year (bold R) */}
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                {edu.degree}
              </Text>
              <Text style={{ fontFamily: ff(true), fontSize: c.fs, color: "#000", flexShrink: 0 }}>
                {edu.year}
              </Text>
            </View>
            {/* Institution — plain text, not italic */}
            <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#333", marginBottom: 2 }}>
              {edu.institution}
            </Text>
          </View>
        ))}
      </View>
    ),

    // Skills: 3-column bullet grid (no pill badges)
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
          <BandHeader id="skills" />
          <View style={{ flexDirection: "row" }}>
            {columns.map((col, ci) => (
              <View key={ci} style={{ flex: 1, paddingRight: ci < columns.length - 1 ? 8 : 0 }}>
                {col.map((skill, si) => (
                  <View key={si} style={{ flexDirection: "row", marginBottom: compact ? 1 : 2 }}>
                    <Text style={{ fontSize: c.fs, color: "#000", width: 12, flexShrink: 0 }}>•</Text>
                    <Text style={{ flex: 1, fontSize: c.fsSmall, color: "#111" }}>{skill}</Text>
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
            {i === 0 && <BandHeader id="projects" />}
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                {proj.name}
                {proj.tech && proj.tech.length > 0
                  ? <Text style={{ fontFamily: ff(false), fontSize: c.fsTiny, color: "#444" }}>
                      {" · "}{proj.tech.join(", ")}
                    </Text>
                  : null}
              </Text>
              {(proj.url || proj.github) && (
                <Link src={proj.url || proj.github || ""} style={{ textDecoration: "none", flexShrink: 0 }}>
                  <Text style={{ fontSize: c.fsTiny, color: "#333" }}>
                    {proj.url ? "↗ live" : "↗ github"}
                  </Text>
                </Link>
              )}
            </View>
            {proj.description && (
              <RichText style={{ fontSize: c.fsSmall, color: "#333", marginBottom: 2 }} accentColor="#000">
                {proj.description}
              </RichText>
            )}
            {proj.bullets.map((b, j) => <BulletRow key={j} text={b} />)}
          </View>
        ))}
      </View>
    ),

    certifications: (content.certifications?.length ?? 0) > 0 && (
      <View key="certifications" style={{ marginBottom: c.secGap }}>
        {content.certifications!.map((cert, i) => (
          <View key={i} wrap={false} style={{ marginBottom: i < content.certifications!.length - 1 ? 5 : 0 }}>
            {i === 0 && <BandHeader id="certifications" />}
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#000", minWidth: 0 }}>
                {cert.name}
              </Text>
              {cert.date && (
                <Text style={{ fontFamily: ff(true), fontSize: c.fs, color: "#000", flexShrink: 0 }}>{cert.date}</Text>
              )}
            </View>
            <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#333" }}>
              {cert.issuer}
              {cert.credentialId ? `  ·  ID: ${cert.credentialId}` : ""}
              {cert.expiry ? `  ·  Expires: ${cert.expiry}` : ""}
            </Text>
          </View>
        ))}
      </View>
    ),
  };

  // ── Page ──────────────────────────────────────────────────────────────────

  return (
    <Document>
      <Page size="A4" style={{ padding: c.pagePad, fontFamily: ff(), fontSize: c.fs, color: "#000" }}>

        {/* Name — ALL CAPS, bold, centered, large */}
        <Text style={{
          fontSize: c.fsName,
          fontFamily: ff(true),
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "#000",
          marginBottom: compact ? 2 : 3,
        }}>
          {content.name || "Your Name"}
        </Text>

        {/* Headline — derived from experience[0].title, centered, not bold */}
        {content.experience[0]?.title && (
          <Text style={{
            fontSize: c.fs + 0.5,
            fontFamily: ff(false),
            textAlign: "center",
            color: "#222",
            marginBottom: compact ? 4 : 6,
          }}>
            {content.experience[0].title}
          </Text>
        )}

        {/* Contact — pipe-separated / thin rule below only */}
        {contactParts.length > 0 && (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginBottom: compact ? 4 : 5 }}>
              {contactParts.map((part, i) => (
                <Text key={i} style={{ fontSize: c.fsTiny, color: "#333" }}>
                  {i > 0 ? " | " : ""}{part}
                </Text>
              ))}
            </View>
            <View style={{ borderBottomWidth: 0.75, borderBottomColor: "#555", marginBottom: c.secGap }} />
          </>
        )}

        {/* Sections — same ordering logic as before */}
        {sectionOrder.map(id => {
          if (id in sections) return sections[id] || null;
          const custom = content.customSections?.find(s => s.id === id);
          if (!custom) return null;
          return (
            <CustomSectionBlock
              key={id}
              section={custom}
              accentColor="#000"
              headerStyle={bandText}
              headerBorder={bandContainer}
              headerGap={c.headerGap}
              titleStyle={{ fontFamily: ff(true), fontSize: c.fs, color: "#000" }}
              subtitleStyle={{ fontFamily: ff(true), fontSize: c.fs, color: "#000" }}
              bulletMarker="•"
              bulletMarkerStyle={{ fontSize: c.fs, color: "#000", width: 12, flexShrink: 0 }}
              bulletTextStyle={{ flex: 1, fontSize: c.fsSmall, color: "#111", minWidth: 0 }}
              secGap={c.secGap}
              itemGap={c.jobGap}
              bulletGap={c.bulletGap}
            />
          );
        })}

      </Page>
    </Document>
  );
}
