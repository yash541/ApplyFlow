import { Document, Page, Text, View, Link } from "@react-pdf/renderer";
import { fontFamily, fontItalic, makeConfig, DEFAULT_SECTION_ORDER, getSectionLabel, flattenSkills, type TemplateProps } from "./shared";
import { ContactLinks } from "./ContactLinks";
import { RichText } from "./RichText";
import { CustomSectionBlock } from "./CustomSectionBlock";

export function MinimalTemplate({ content, accentColor, fontStyle, compact, layout = {}, sectionOrder = DEFAULT_SECTION_ORDER }: TemplateProps) {
  const ff = (bold = false) => fontFamily(fontStyle, bold);
  const fi = () => fontItalic(fontStyle);
  const c = makeConfig(compact, layout);

  const headerStyle = { fontSize: c.fsTiny, fontFamily: ff(true), textTransform: "uppercase" as const, letterSpacing: 2, color: "#111" };
  // Minimal is intentionally more spacious; add a fixed offset on top of the layout-scaled base
  // so the spacing slider still works while preserving the open, airy character of this template.
  const secGap = c.secGap + (compact ? 5 : 8);
  const headerGap = c.headerGap + (compact ? 3 : 4);

  const sections: Record<string, React.ReactNode> = {
    summary: !!content.summary && (
      <RichText key="summary" style={{ fontSize: c.fsSmall, color: "#444", marginBottom: secGap }} accentColor={accentColor}>
        {content.summary}
      </RichText>
    ),
    experience: content.experience.length > 0 && (
      <View key="experience" style={{ marginBottom: secGap }}>
        {content.experience.length > 0 ? (
          <>
            <View wrap={false}>
              <Text style={{ ...headerStyle, marginBottom: headerGap }}>{getSectionLabel("experience", content)}</Text>
              <View style={{ marginBottom: c.jobGap }}>
                <View style={{ flexDirection: "row", marginBottom: 1 }}>
                  <Text style={{ flex: 1, fontSize: c.fs + 1, fontFamily: ff(true), minWidth: 0 }}>{content.experience[0]!.title}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#999", flexShrink: 0 }}>{content.experience[0]!.duration}</Text>
                </View>
                <Text style={{ fontSize: c.fsSmall, fontFamily: fi(), color: "#666", marginBottom: 4 }}>{content.experience[0]!.company}</Text>
                {content.experience[0]!.bullets.map((b, j) => (
                  <View key={j} style={{ flexDirection: "row", marginBottom: c.bulletGap, paddingLeft: 6 }}>
                    <Text style={{ fontSize: c.fs, color: "#bbb", width: 12, flexShrink: 0 }}>—</Text>
                    <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#333", minWidth: 0 }} accentColor={accentColor}>{b}</RichText>
                  </View>
                ))}
              </View>
            </View>
            {content.experience.slice(1).map((job, i) => (
              <View key={i + 1} wrap={false} style={{ marginBottom: c.jobGap }}>
                <View style={{ flexDirection: "row", marginBottom: 1 }}>
                  <Text style={{ flex: 1, fontSize: c.fs + 1, fontFamily: ff(true), minWidth: 0 }}>{job.title}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#999", flexShrink: 0 }}>{job.duration}</Text>
                </View>
                <Text style={{ fontSize: c.fsSmall, fontFamily: fi(), color: "#666", marginBottom: 4 }}>{job.company}</Text>
                {job.bullets.map((b, j) => (
                  <View key={j} style={{ flexDirection: "row", marginBottom: c.bulletGap, paddingLeft: 6 }}>
                    <Text style={{ fontSize: c.fs, color: "#bbb", width: 12, flexShrink: 0 }}>—</Text>
                    <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#333", minWidth: 0 }} accentColor={accentColor}>{b}</RichText>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : (
          <Text style={{ ...headerStyle, marginBottom: headerGap }}>{getSectionLabel("experience", content)}</Text>
        )}
      </View>
    ),
    education: content.education.length > 0 && (
      <View key="education" style={{ marginBottom: secGap }}>
        {content.education.length > 0 ? (
          <>
            <View wrap={false}>
              <Text style={{ ...headerStyle, marginBottom: headerGap }}>{getSectionLabel("education", content)}</Text>
              <View style={{ marginBottom: 5 }}>
                <View style={{ flexDirection: "row" }}>
                  <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, minWidth: 0 }}>{content.education[0]!.degree}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#aaa", flexShrink: 0 }}>{content.education[0]!.year}</Text>
                </View>
                <Text style={{ fontSize: c.fsSmall, fontFamily: fi(), color: "#666" }}>{content.education[0]!.institution}</Text>
              </View>
            </View>
            {content.education.slice(1).map((edu, i) => (
              <View key={i + 1} wrap={false} style={{ marginBottom: 5 }}>
                <View style={{ flexDirection: "row" }}>
                  <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, minWidth: 0 }}>{edu.degree}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#aaa", flexShrink: 0 }}>{edu.year}</Text>
                </View>
                <Text style={{ fontSize: c.fsSmall, fontFamily: fi(), color: "#666" }}>{edu.institution}</Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={{ ...headerStyle, marginBottom: headerGap }}>{getSectionLabel("education", content)}</Text>
        )}
      </View>
    ),
    skills: flattenSkills(content).length > 0 && (
      <View wrap={false} key="skills" style={{ marginBottom: c.secGap }}>
        <Text style={{ ...headerStyle, marginBottom: headerGap }}>{getSectionLabel("skills", content)}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {flattenSkills(content).map((skill, i) => (
            <View key={i} style={{ borderWidth: 0.5, borderColor: "#ddd", borderRadius: 2, paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2, marginRight: 4, marginBottom: 3 }}>
              <Text style={{ fontSize: c.fsSmall, color: "#444" }}>{skill}</Text>
            </View>
          ))}
        </View>
      </View>
    ),
    projects: (content.projects?.length ?? 0) > 0 && (
      <View key="projects" style={{ marginBottom: secGap }}>
        {content.projects!.map((proj, i) => (
          <View key={i} wrap={false} style={{ marginBottom: c.jobGap }}>
            {i === 0 && <Text style={{ ...headerStyle, marginBottom: headerGap }}>{getSectionLabel("projects", content)}</Text>}
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, fontSize: c.fs + 1, fontFamily: ff(true), minWidth: 0 }}>{proj.name}</Text>
              {(proj.url || proj.github) && (
                <Link src={proj.url || proj.github || ""} style={{ textDecoration: "none" }}>
                  <Text style={{ fontSize: c.fsTiny, color: accentColor, flexShrink: 0 }}>↗</Text>
                </Link>
              )}
            </View>
            {proj.tech && proj.tech.length > 0 && (
              <Text style={{ fontSize: c.fsTiny, fontFamily: fi(), color: "#888", marginBottom: 2 }}>{proj.tech.join(" · ")}</Text>
            )}
            {proj.bullets.map((b, j) => (
              <View key={j} style={{ flexDirection: "row", marginBottom: c.bulletGap, paddingLeft: 6 }}>
                <Text style={{ fontSize: c.fs, color: "#bbb", width: 12, flexShrink: 0 }}>—</Text>
                <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#333", minWidth: 0 }} accentColor={accentColor}>{b}</RichText>
              </View>
            ))}
          </View>
        ))}
      </View>
    ),
    certifications: (content.certifications?.length ?? 0) > 0 && (
      <View key="certifications" style={{ marginBottom: secGap }}>
        {content.certifications!.map((cert, i) => (
          <View key={i} wrap={false} style={{ marginBottom: 5 }}>
            {i === 0 && <Text style={{ ...headerStyle, marginBottom: headerGap }}>{getSectionLabel("certifications", content)}</Text>}
            <View style={{ flexDirection: "row" }}>
              <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, minWidth: 0 }}>{cert.name}</Text>
              {cert.date && <Text style={{ fontSize: c.fsTiny, color: "#aaa", flexShrink: 0 }}>{cert.date}</Text>}
            </View>
            <Text style={{ fontSize: c.fsSmall, fontFamily: fi(), color: "#666" }}>{cert.issuer}</Text>
            {cert.credentialId && <Text style={{ fontSize: c.fsTiny, color: "#aaa" }}>ID: {cert.credentialId}</Text>}
          </View>
        ))}
      </View>
    ),
  };

  return (
    <Document>
      <Page size="A4" style={{ padding: compact ? "26pt 38pt" : c.pagePad, fontFamily: ff(), fontSize: c.fs, color: "#111" }}>
        <Text style={{ fontSize: compact ? 20 : 26, fontFamily: ff(true), marginBottom: compact ? 8 : 14, letterSpacing: -0.5 }}>
          {content.name || "Your Name"}
        </Text>
        <View style={{ marginBottom: secGap }}>
          <ContactLinks contact={content.contact} textStyle={{ fontSize: c.fsSmall - 0.5, color: "#666" }} accentColor={accentColor} />
        </View>
        {sectionOrder.map(id => {
          if (id in sections) return sections[id] || null;
          const custom = content.customSections?.find(s => s.id === id);
          if (!custom) return null;
          return (
            <CustomSectionBlock key={id} section={custom} accentColor={accentColor}
              headerStyle={headerStyle} headerGap={headerGap}
              titleStyle={{ flex: 1, fontSize: c.fs + 1, fontFamily: ff(true) }}
              subtitleStyle={{ fontSize: c.fsTiny, color: "#999" }}
              bulletMarker="—" bulletMarkerStyle={{ fontSize: c.fs, color: "#bbb", width: 12, flexShrink: 0 }}
              bulletTextStyle={{ flex: 1, fontSize: c.fsSmall, color: "#333", minWidth: 0 }}
              secGap={secGap} itemGap={c.jobGap} bulletGap={c.bulletGap} bulletPaddingLeft={6}
            />
          );
        })}
      </Page>
    </Document>
  );
}
