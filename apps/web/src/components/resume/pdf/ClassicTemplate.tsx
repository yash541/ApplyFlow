import { Document, Page, Text, View } from "@react-pdf/renderer";
import { fontFamily, fontItalic, makeConfig, DEFAULT_SECTION_ORDER, getSectionLabel, flattenSkills, type TemplateProps } from "./shared";
import { ContactLinks } from "./ContactLinks";
import { RichText } from "./RichText";
import { CustomSectionBlock } from "./CustomSectionBlock";

export function ClassicTemplate({ content, accentColor, fontStyle, compact, layout = {}, sectionOrder = DEFAULT_SECTION_ORDER }: TemplateProps) {
  const ff = (bold = false) => fontFamily(fontStyle, bold);
  const fi = () => fontItalic(fontStyle);
  const c = makeConfig(compact, layout);

  const headerStyle = { fontSize: c.fs, fontFamily: ff(true), textTransform: "uppercase" as const, letterSpacing: 0.8, color: accentColor };
  const headerBorder = { borderBottomWidth: 0.5, borderBottomColor: "#ddd", marginBottom: c.headerGap };

  const sections: Record<string, React.ReactNode> = {
    summary: !!content.summary && (
      <View wrap={false} key="summary" style={{ marginBottom: c.secGap }}>
        <Text style={{ ...headerStyle, marginBottom: c.headerGap }}>{getSectionLabel("summary", content)}</Text>
        <RichText style={{ fontSize: c.fsSmall, color: "#333", marginBottom: 2 }} accentColor={accentColor}>{content.summary}</RichText>
      </View>
    ),
    experience: content.experience.length > 0 && (
      <View key="experience" style={{ marginBottom: c.secGap }}>
        {content.experience.length > 0 ? (
          <>
            <View wrap={false}>
              <View style={headerBorder}>
                <Text style={{ ...headerStyle, marginBottom: 3 }}>{getSectionLabel("experience", content)}</Text>
              </View>
              <View style={{ marginBottom: c.jobGap }}>
                <View style={{ flexDirection: "row", marginBottom: 1 }}>
                  <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, minWidth: 0 }}>{content.experience[0]!.title}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#666", flexShrink: 0 }}>{content.experience[0]!.duration}</Text>
                </View>
                <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#555", marginBottom: 3 }}>{content.experience[0]!.company}</Text>
                {content.experience[0]!.bullets.map((b, j) => (
                  <View key={j} style={{ flexDirection: "row", marginBottom: c.bulletGap }}>
                    <Text style={{ fontSize: c.fs, color: accentColor, width: 10, flexShrink: 0 }}>•</Text>
                    <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#222", minWidth: 0 }} accentColor={accentColor}>{b}</RichText>
                  </View>
                ))}
              </View>
            </View>
            {content.experience.slice(1).map((job, i) => (
              <View key={i + 1} wrap={false} style={{ marginBottom: c.jobGap }}>
                <View style={{ flexDirection: "row", marginBottom: 1 }}>
                  <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, minWidth: 0 }}>{job.title}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#666", flexShrink: 0 }}>{job.duration}</Text>
                </View>
                <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#555", marginBottom: 3 }}>{job.company}</Text>
                {job.bullets.map((b, j) => (
                  <View key={j} style={{ flexDirection: "row", marginBottom: c.bulletGap }}>
                    <Text style={{ fontSize: c.fs, color: accentColor, width: 10, flexShrink: 0 }}>•</Text>
                    <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#222", minWidth: 0 }} accentColor={accentColor}>{b}</RichText>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : (
          <View style={headerBorder}>
            <Text style={{ ...headerStyle, marginBottom: 3 }}>{getSectionLabel("experience", content)}</Text>
          </View>
        )}
      </View>
    ),
    education: content.education.length > 0 && (
      <View key="education" style={{ marginBottom: c.secGap }}>
        {content.education.length > 0 ? (
          <>
            <View wrap={false}>
              <View style={headerBorder}>
                <Text style={{ ...headerStyle, marginBottom: 3 }}>{getSectionLabel("education", content)}</Text>
              </View>
              <View style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: "row" }}>
                  <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, minWidth: 0 }}>{content.education[0]!.degree}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#666", flexShrink: 0 }}>{content.education[0]!.year}</Text>
                </View>
                <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#555" }}>{content.education[0]!.institution}</Text>
              </View>
            </View>
            {content.education.slice(1).map((edu, i) => (
              <View key={i + 1} wrap={false} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: "row" }}>
                  <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, minWidth: 0 }}>{edu.degree}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#666", flexShrink: 0 }}>{edu.year}</Text>
                </View>
                <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#555" }}>{edu.institution}</Text>
              </View>
            ))}
          </>
        ) : (
          <View style={headerBorder}>
            <Text style={{ ...headerStyle, marginBottom: 3 }}>{getSectionLabel("education", content)}</Text>
          </View>
        )}
      </View>
    ),
    skills: flattenSkills(content).length > 0 && (
      <View wrap={false} key="skills" style={{ marginBottom: c.secGap }}>
        <View style={headerBorder}>
          <Text style={{ ...headerStyle, marginBottom: 3 }}>{getSectionLabel("skills", content)}</Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {flattenSkills(content).map((skill, i) => (
            <View key={i} style={{ backgroundColor: "#f2f2f2", borderRadius: 2, paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2, marginRight: 4, marginBottom: 3 }}>
              <Text style={{ fontSize: c.fsSmall, color: "#333" }}>{skill}</Text>
            </View>
          ))}
        </View>
      </View>
    ),
  };

  return (
    <Document>
      <Page size="A4" style={{ padding: c.pagePad, fontFamily: ff(), fontSize: c.fs, color: "#1a1a1a" }}>
        <Text style={{ fontSize: c.fsName, fontFamily: ff(true), textAlign: "center", marginBottom: 3 }}>
          {content.name || "Your Name"}
        </Text>
        <View style={{ alignItems: "center", marginBottom: c.secGap }}>
          <ContactLinks contact={content.contact} textStyle={{ fontSize: c.fsSmall - 0.5, color: "#555" }} accentColor={accentColor} />
        </View>
        <View style={{ borderBottomWidth: 1.5, borderBottomColor: accentColor, marginBottom: c.headerGap + 2 }} />
        {sectionOrder.map(id => {
          if (id in sections) return sections[id] || null;
          const custom = content.customSections?.find(s => s.id === id);
          if (!custom) return null;
          return (
            <CustomSectionBlock key={id} section={custom} accentColor={accentColor}
              headerStyle={headerStyle} headerBorder={headerBorder} headerGap={c.headerGap}
              titleStyle={{ fontFamily: ff(true), fontSize: c.fs }}
              subtitleStyle={{ fontSize: c.fsTiny, color: "#666" }}
              bulletMarker="•" bulletMarkerStyle={{ fontSize: c.fs, color: accentColor, width: 10, flexShrink: 0 }}
              bulletTextStyle={{ flex: 1, fontSize: c.fsSmall, color: "#222", minWidth: 0 }}
              secGap={c.secGap} itemGap={c.jobGap} bulletGap={c.bulletGap}
            />
          );
        })}
      </Page>
    </Document>
  );
}
