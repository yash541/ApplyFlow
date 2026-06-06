import { Document, Page, Text, View, Link } from "@react-pdf/renderer";
import { fontFamily, fontItalic, makeConfig, DEFAULT_SECTION_ORDER, getSectionLabel, autoGroupSkills, flattenSkills, type TemplateProps } from "./shared";
import { ContactLinks } from "./ContactLinks";
import { RichText } from "./RichText";
import { CustomSectionBlock } from "./CustomSectionBlock";

export function ATSSafeTemplate({ content, accentColor, fontStyle, compact, layout = {}, sectionOrder = DEFAULT_SECTION_ORDER }: TemplateProps) {
  const ff = (bold = false) => fontFamily(fontStyle, bold);
  const fi = () => fontItalic(fontStyle);
  const c = makeConfig(compact, layout);
  // Accent line sits just above the content area; derive coordinates from actual page padding
  // so it stays aligned when the margins slider changes.
  // In compact mode pagePad top = 22pt → line must be at 21pt (1pt inside margin, not into text)
  const accentLineTop  = compact ? 21 : Math.round(40 * c.m) - 1;
  const accentLineSide = compact ? 31 : Math.round(52 * c.m);

  const headerStyle = { fontFamily: ff(true), fontSize: c.fs + 1, textTransform: "uppercase" as const };

  const sections: Record<string, React.ReactNode> = {
    summary: !!content.summary && (
      <View wrap={false} key="summary" style={{ marginBottom: c.secGap }}>
        <Text style={{ ...headerStyle, marginBottom: c.headerGap }}>{getSectionLabel("summary", content)}</Text>
        <RichText style={{ fontSize: c.fsSmall, color: "#111" }} accentColor={accentColor}>{content.summary}</RichText>
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#999", marginTop: compact ? 6 : 10 }} />
      </View>
    ),
    experience: content.experience.length > 0 && (
      <View key="experience" style={{ marginBottom: c.secGap }}>
        {content.experience.length > 0 ? (
          <>
            <View wrap={false}>
              <Text style={{ ...headerStyle, marginBottom: c.headerGap }}>{getSectionLabel("experience", content)}</Text>
              <View style={{ marginBottom: c.jobGap }}>
                <Text style={{ fontFamily: ff(true), fontSize: c.fs }}>{content.experience[0]!.title}</Text>
                <View style={{ flexDirection: "row", marginBottom: 3 }}>
                  <Text style={{ flex: 1, fontFamily: fi(), fontSize: c.fsSmall, color: "#333", minWidth: 0 }}>{content.experience[0]!.company}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#333", flexShrink: 0 }}>{content.experience[0]!.duration}</Text>
                </View>
                {content.experience[0]!.bullets.map((b, j) => (
                  <View key={j} style={{ flexDirection: "row", marginBottom: c.bulletGap }}>
                    <Text style={{ fontSize: c.fs, width: 12, flexShrink: 0 }}>•</Text>
                    <RichText style={{ flex: 1, fontSize: c.fsSmall, minWidth: 0 }} accentColor={accentColor}>{b}</RichText>
                  </View>
                ))}
              </View>
            </View>
            {content.experience.slice(1).map((job, i) => (
              <View key={i + 1} wrap={false} style={{ marginBottom: c.jobGap }}>
                <Text style={{ fontFamily: ff(true), fontSize: c.fs }}>{job.title}</Text>
                <View style={{ flexDirection: "row", marginBottom: 3 }}>
                  <Text style={{ flex: 1, fontFamily: fi(), fontSize: c.fsSmall, color: "#333", minWidth: 0 }}>{job.company}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#333", flexShrink: 0 }}>{job.duration}</Text>
                </View>
                {job.bullets.map((b, j) => (
                  <View key={j} style={{ flexDirection: "row", marginBottom: c.bulletGap }}>
                    <Text style={{ fontSize: c.fs, width: 12, flexShrink: 0 }}>•</Text>
                    <RichText style={{ flex: 1, fontSize: c.fsSmall, minWidth: 0 }} accentColor={accentColor}>{b}</RichText>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : (
          <Text style={{ ...headerStyle, marginBottom: c.headerGap }}>{getSectionLabel("experience", content)}</Text>
        )}
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#999" }} />
      </View>
    ),
    education: content.education.length > 0 && (
      <View key="education" style={{ marginBottom: c.secGap }}>
        {content.education.length > 0 ? (
          <>
            <View wrap={false}>
              <Text style={{ ...headerStyle, marginBottom: c.headerGap }}>{getSectionLabel("education", content)}</Text>
              <View style={{ marginBottom: 5 }}>
                <Text style={{ fontFamily: ff(true), fontSize: c.fs }}>{content.education[0]!.degree}</Text>
                <View style={{ flexDirection: "row" }}>
                  <Text style={{ flex: 1, fontFamily: fi(), fontSize: c.fsSmall, color: "#333", minWidth: 0 }}>{content.education[0]!.institution}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#333", flexShrink: 0 }}>{content.education[0]!.year}</Text>
                </View>
              </View>
            </View>
            {content.education.slice(1).map((edu, i) => (
              <View key={i + 1} wrap={false} style={{ marginBottom: 5 }}>
                <Text style={{ fontFamily: ff(true), fontSize: c.fs }}>{edu.degree}</Text>
                <View style={{ flexDirection: "row" }}>
                  <Text style={{ flex: 1, fontFamily: fi(), fontSize: c.fsSmall, color: "#333", minWidth: 0 }}>{edu.institution}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#333", flexShrink: 0 }}>{edu.year}</Text>
                </View>
              </View>
            ))}
          </>
        ) : (
          <Text style={{ ...headerStyle, marginBottom: c.headerGap }}>{getSectionLabel("education", content)}</Text>
        )}
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#999" }} />
      </View>
    ),
    skills: flattenSkills(content).length > 0 && (() => {
      const groups = content.skillGroups ?? autoGroupSkills(content.skills);
      const labelColWidth = compact ? 82 : 96;
      return (
        <View wrap={false} key="skills" style={{ marginBottom: c.secGap }}>
          <Text style={{ ...headerStyle, marginBottom: c.headerGap }}>{getSectionLabel("skills", content)}</Text>
          {groups.map((grp, gi) => (
            <View key={gi} style={{ flexDirection: "row", marginBottom: compact ? 2.5 : 3.5 }}>
              {grp.label ? (
                <Text style={{ fontFamily: ff(true), fontSize: c.fsSmall, width: labelColWidth, flexShrink: 0, color: "#222", paddingRight: 4 }}>
                  {grp.label}
                </Text>
              ) : null}
              <Text style={{ flex: 1, fontSize: c.fsSmall, color: "#111", lineHeight: 1.45 }}>
                {grp.items.join("  •  ")}
              </Text>
            </View>
          ))}
        </View>
      );
    })(),
    projects: (content.projects?.length ?? 0) > 0 && (
      <View key="projects" style={{ marginBottom: c.secGap }}>
        <Text style={{ ...headerStyle, marginBottom: c.headerGap }}>{getSectionLabel("projects", content)}</Text>
        {content.projects!.map((proj, i) => (
          <View key={i} wrap={false} style={{ marginBottom: c.jobGap }}>
            <View style={{ flexDirection: "row" }}>
              <Text style={{ fontFamily: ff(true), fontSize: c.fs, flex: 1, minWidth: 0 }}>{proj.name}</Text>
              {proj.tech && proj.tech.length > 0 && (
                <Text style={{ fontSize: c.fsTiny, color: "#555", flexShrink: 0 }}>{proj.tech.join(", ")}</Text>
              )}
            </View>
            {(proj.url || proj.github) && (
              <Link src={proj.url || proj.github || ""} style={{ textDecoration: "none" }}>
                <Text style={{ fontSize: c.fsTiny, color: "#333", marginBottom: 2 }}>{proj.url || proj.github}</Text>
              </Link>
            )}
            {proj.bullets.map((b, j) => (
              <View key={j} style={{ flexDirection: "row", marginBottom: c.bulletGap }}>
                <Text style={{ fontSize: c.fs, width: 12, flexShrink: 0 }}>•</Text>
                <RichText style={{ flex: 1, fontSize: c.fsSmall, minWidth: 0 }} accentColor={accentColor}>{b}</RichText>
              </View>
            ))}
          </View>
        ))}
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#999" }} />
      </View>
    ),
    certifications: (content.certifications?.length ?? 0) > 0 && (
      <View key="certifications" style={{ marginBottom: c.secGap }}>
        <Text style={{ ...headerStyle, marginBottom: c.headerGap }}>{getSectionLabel("certifications", content)}</Text>
        {content.certifications!.map((cert, i) => (
          <View key={i} wrap={false} style={{ flexDirection: "row", marginBottom: compact ? 3 : 4 }}>
            <Text style={{ fontFamily: ff(true), fontSize: c.fsSmall, width: compact ? 120 : 140, flexShrink: 0, paddingRight: 6 }}>{cert.name}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#333" }}>{cert.issuer}</Text>
              {cert.credentialId && <Text style={{ fontSize: c.fsTiny, color: "#555" }}>ID: {cert.credentialId}</Text>}
            </View>
            {cert.date && <Text style={{ fontSize: c.fsTiny, color: "#555", flexShrink: 0 }}>{cert.date}</Text>}
          </View>
        ))}
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#999" }} />
      </View>
    ),
  };

  return (
    <Document>
      <Page size="A4" style={{ padding: c.pagePad, fontFamily: ff(), fontSize: c.fs, color: "#000" }}>
        <Text style={{ fontSize: compact ? 18 : 20, fontFamily: ff(true), marginBottom: 2 }}>
          {content.name || "Your Name"}
        </Text>
        <View style={{ marginBottom: c.secGap }}>
          <ContactLinks contact={content.contact} textStyle={{ fontSize: c.fsSmall - 0.5, color: "#333" }} accentColor={accentColor} />
        </View>
        <View style={{ borderBottomWidth: 2, borderBottomColor: "#000", marginBottom: c.headerGap + 2 }} />
        {sectionOrder.map(id => {
          if (id in sections) return sections[id] || null;
          const custom = content.customSections?.find(s => s.id === id);
          if (!custom) return null;
          return (
            <CustomSectionBlock key={id} section={custom} accentColor={accentColor}
              headerStyle={headerStyle} headerGap={c.headerGap}
              titleStyle={{ fontFamily: ff(true), fontSize: c.fs }}
              subtitleStyle={{ fontSize: c.fsTiny, color: "#333" }}
              bulletMarker="•" bulletMarkerStyle={{ fontSize: c.fs, width: 12, flexShrink: 0 }}
              bulletTextStyle={{ flex: 1, fontSize: c.fsSmall, minWidth: 0 }}
              secGap={c.secGap} itemGap={c.jobGap} bulletGap={c.bulletGap}
            />
          );
        })}
        {/* Accent line — tracks page padding so it stays flush with the content margins */}
        <View style={{ position: "absolute", top: accentLineTop, left: accentLineSide, right: accentLineSide, height: 2, backgroundColor: accentColor }} />
      </Page>
    </Document>
  );
}
