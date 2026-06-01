import { Document, Page, Text, View } from "@react-pdf/renderer";
import { fontFamily, fontItalic, makeConfig, DEFAULT_SECTION_ORDER, getSectionLabel, flattenSkills, type TemplateProps } from "./shared";
import { ContactLinks } from "./ContactLinks";
import { RichText } from "./RichText";
import { CustomSectionBlock } from "./CustomSectionBlock";

export function ExecutiveTemplate({ content, accentColor, fontStyle, compact, layout = {}, sectionOrder = DEFAULT_SECTION_ORDER }: TemplateProps) {
  const ff = (bold = false) => fontFamily(fontStyle, bold);
  const fi = () => fontItalic(fontStyle);
  const c = makeConfig(compact, layout);
  const m = c.m;
  // Header banner and body padding scale with the margins slider
  const headerPad = compact
    ? "20pt 32pt 14pt 32pt"
    : `${Math.round(28 * m)}pt ${Math.round(40 * m)}pt ${Math.round(20 * m)}pt ${Math.round(40 * m)}pt`;
  const bodyPad = compact
    ? "16pt 32pt 12pt 32pt"   // reduce bottom from 32→12 in compact to avoid blank page 2
    : `${Math.round(22 * m)}pt ${Math.round(40 * m)}pt ${Math.round(40 * m)}pt ${Math.round(40 * m)}pt`;

  const bodyOrder = sectionOrder.filter(id => id === "summary" || id === "experience" || id.startsWith("custom_"));
  const showEdu = sectionOrder.includes("education") && content.education.length > 0;
  const showSkills = sectionOrder.includes("skills") && flattenSkills(content).length > 0;

  const headerStyle = { fontSize: c.fsTiny, fontFamily: ff(true), textTransform: "uppercase" as const, letterSpacing: 1.5, color: accentColor };

  const bodySections: Record<string, React.ReactNode> = {
    summary: !!content.summary && (
      <View key="summary" style={{ marginBottom: c.secGap }}>
        <Text style={{ ...headerStyle, marginBottom: c.headerGap }}>{getSectionLabel("summary", content)}</Text>
        <RichText style={{ fontSize: c.fsSmall, color: "#374151", fontFamily: fi() }} accentColor={accentColor}>
          {content.summary}
        </RichText>
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", marginTop: c.headerGap + 4 }} />
      </View>
    ),
    experience: content.experience.length > 0 && (
      <View key="experience" style={{ marginBottom: c.secGap }}>
        <Text style={{ ...headerStyle, marginBottom: c.headerGap }}>{getSectionLabel("experience", content)}</Text>
        {content.experience.map((job, i) => (
          <View key={i} style={{ marginBottom: c.jobGap }}>
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              {/* Height matches the title font size so it stays aligned when fontDelta changes */}
              <View style={{ width: 3, backgroundColor: accentColor, marginRight: 8, flexShrink: 0, marginTop: 1.5, height: c.fs + 1 }} />
              <Text style={{ flex: 1, fontSize: c.fs + 1, fontFamily: ff(true), color: "#111827", minWidth: 0 }}>{job.title}</Text>
              <Text style={{ fontSize: c.fsTiny, color: "#9ca3af", flexShrink: 0 }}>{job.duration}</Text>
            </View>
            <Text style={{ fontSize: c.fsSmall, fontFamily: fi(), color: "#6b7280", marginBottom: 3, paddingLeft: 11 }}>
              {job.company}
            </Text>
            {job.bullets.map((b, j) => (
              <View key={j} style={{ flexDirection: "row", marginBottom: c.bulletGap, paddingLeft: 11 }}>
                <Text style={{ fontSize: c.fsSmall, color: accentColor, width: 10, flexShrink: 0 }}>▸</Text>
                <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#374151", minWidth: 0 }} accentColor={accentColor}>{b}</RichText>
              </View>
            ))}
          </View>
        ))}
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" }} />
      </View>
    ),
  };

  return (
    <Document>
      <Page size="A4" style={{ padding: 0, fontFamily: ff(), fontSize: c.fs, color: "#1a1a2e" }}>
        <View style={{ backgroundColor: accentColor, padding: headerPad }}>
          <Text style={{ fontSize: compact ? 20 : 24, fontFamily: ff(true), color: "#fff", marginBottom: 2 }}>
            {content.name || "Your Name"}
          </Text>
          {content.experience[0] && (
            <Text style={{ fontSize: compact ? 9 : 11, color: "rgba(255,255,255,0.80)", marginBottom: 6, fontFamily: fi() }}>
              {content.experience[0].title}
            </Text>
          )}
          <ContactLinks contact={content.contact} textStyle={{ fontSize: c.fsTiny, color: "rgba(255,255,255,0.70)" }} accentColor="rgba(255,255,255,0.95)" />
        </View>

        <View style={{ padding: bodyPad }}>
          {bodyOrder.map(id => {
            if (id in bodySections) return bodySections[id] || null;
            const custom = content.customSections?.find(s => s.id === id);
            if (!custom) return null;
            return (
              <CustomSectionBlock key={id} section={custom} accentColor={accentColor}
                headerStyle={headerStyle} headerGap={c.headerGap}
                titleStyle={{ fontSize: c.fs + 1, fontFamily: ff(true), color: "#111827" }}
                subtitleStyle={{ fontSize: c.fsTiny, color: "#9ca3af" }}
                bulletMarker="▸" bulletMarkerStyle={{ fontSize: c.fsSmall, color: accentColor, width: 10, flexShrink: 0 }}
                bulletTextStyle={{ flex: 1, fontSize: c.fsSmall, color: "#374151", minWidth: 0 }}
                secGap={c.secGap} itemGap={c.jobGap} bulletGap={c.bulletGap} bulletPaddingLeft={11}
              />
            );
          })}

          {(showEdu || showSkills) && (
            <View style={{ flexDirection: "row", marginTop: compact ? 10 : 14 }}>
              {showEdu && (
                <View style={{ flex: 1, marginRight: 16, minWidth: 0 }}>
                  <Text style={{ ...headerStyle, marginBottom: c.headerGap }}>{getSectionLabel("education", content)}</Text>
                  {content.education.map((edu, i) => (
                    <View key={i} style={{ marginBottom: 6 }}>
                      <Text style={{ fontFamily: ff(true), fontSize: c.fs, minWidth: 0 }}>{edu.degree}</Text>
                      <Text style={{ fontSize: c.fsTiny, fontFamily: fi(), color: "#6b7280" }}>{edu.institution}</Text>
                      <Text style={{ fontSize: c.fsTiny, color: accentColor }}>{edu.year}</Text>
                    </View>
                  ))}
                </View>
              )}
              {showSkills && (
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...headerStyle, marginBottom: c.headerGap }}>{getSectionLabel("skills", content)}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {flattenSkills(content).map((skill, i) => (
                      <View key={i} style={{ borderWidth: 0.5, borderColor: accentColor, borderRadius: 2, paddingLeft: 5, paddingRight: 5, paddingTop: 1.5, paddingBottom: 1.5, marginRight: 4, marginBottom: 3 }}>
                        <Text style={{ fontSize: c.fsTiny, color: "#374151" }}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}
