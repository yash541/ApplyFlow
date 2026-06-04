import { Document, Page, Text, View } from "@react-pdf/renderer";
import { fontFamily, fontItalic, makeConfig, DEFAULT_SECTION_ORDER, getSectionLabel, flattenSkills, type TemplateProps } from "./shared";
import { ContactLinks } from "./ContactLinks";
import { RichText } from "./RichText";
import { CustomSectionBlock } from "./CustomSectionBlock";

export function ModernTemplate({ content, accentColor, fontStyle, compact, layout = {}, sectionOrder = DEFAULT_SECTION_ORDER, columnMap }: TemplateProps) {
  const ff = (bold = false) => fontFamily(fontStyle, bold);
  const fi = () => fontItalic(fontStyle);
  const c = makeConfig(compact, layout);
  const SIDEBAR_W = compact ? 140 : (layout.sidebarWidth ?? 162);
  // m is the margins multiplier from makeConfig; used to scale padding strings
  const m = c.m;

  // Default: skills + education → sidebar, everything else → main
  function getCol(id: string): "sidebar" | "main" {
    if (columnMap?.[id]) return columnMap[id]!;
    return (id === "skills" || id === "education") ? "sidebar" : "main";
  }

  const sidebarOrder = sectionOrder.filter(id => getCol(id) === "sidebar");
  const mainOrder    = sectionOrder.filter(id => getCol(id) === "main");

  const sidebarLabel = {
    fontSize: c.fsTiny - 0.5, fontFamily: ff(true), color: accentColor,
    textTransform: "uppercase" as const, letterSpacing: 1.2, marginBottom: 4,
  };
  // Use c.secGap so the spacing slider affects sidebar section gaps too
  const sidebarGap = c.secGap;
  // Padding strings scaled by margins multiplier so the margins slider works
  const sidebarPad = compact ? "24pt 12pt" : `${Math.round(36 * m)}pt ${Math.round(14 * m)}pt`;
  const mainPad    = compact ? "24pt 18pt 24pt 14pt" : `${Math.round(36 * m)}pt ${Math.round(22 * m)}pt ${Math.round(36 * m)}pt ${Math.round(18 * m)}pt`;

  const mainHeaderStyle = {
    fontSize: c.fsTiny, fontFamily: ff(true), color: accentColor,
    textTransform: "uppercase" as const, letterSpacing: 0.8,
  };

  // ── Sidebar renders any section type in dark-panel style ─────────────────
  function renderSidebarSection(id: string) {
    if (id === "skills" && flattenSkills(content).length > 0) {
      return (
        <View key={id}>
          <Text style={{ ...sidebarLabel, marginTop: sidebarGap }}>{getSectionLabel("skills", content)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {flattenSkills(content).map((skill, i) => (
              <View key={i} style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, marginRight: 3, marginBottom: 3 }}>
                <Text style={{ fontSize: c.fsTiny - 0.5, color: "#e2e8f0" }}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (id === "education" && content.education.length > 0) {
      return (
        <View key={id}>
          <Text style={{ ...sidebarLabel, marginTop: sidebarGap }}>{getSectionLabel("education", content)}</Text>
          {content.education.map((edu, i) => (
            <View key={i} style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: c.fsSmall - 0.5, fontFamily: ff(true), color: "#fff" }}>{edu.degree}</Text>
              <Text style={{ fontSize: c.fsTiny - 0.5, color: "#94a3b8" }}>{edu.institution}</Text>
              <Text style={{ fontSize: c.fsTiny - 0.5, color: accentColor }}>{edu.year}</Text>
            </View>
          ))}
        </View>
      );
    }

    if (id === "summary" && content.summary) {
      return (
        <View key={id}>
          <Text style={{ ...sidebarLabel, marginTop: sidebarGap }}>{getSectionLabel("summary", content)}</Text>
          <RichText style={{ fontSize: c.fsTiny, color: "#cbd5e1" }} accentColor="#93c5fd">{content.summary}</RichText>
        </View>
      );
    }

    if (id === "experience" && content.experience.length > 0) {
      return (
        <View key={id}>
          <Text style={{ ...sidebarLabel, marginTop: sidebarGap }}>{getSectionLabel("experience", content)}</Text>
          {content.experience.map((job, i) => (
            <View key={i} style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: c.fsTiny, fontFamily: ff(true), color: "#fff" }}>{job.title}</Text>
              <Text style={{ fontSize: c.fsTiny - 0.5, fontFamily: fi(), color: "#94a3b8", marginBottom: 2 }}>{job.company}</Text>
              {job.bullets.map((b, j) => (
                <View key={j} style={{ flexDirection: "row", marginBottom: 1.5 }}>
                  <Text style={{ fontSize: c.fsTiny - 0.5, color: accentColor, width: 7, flexShrink: 0 }}>›</Text>
                  <RichText style={{ fontSize: c.fsTiny - 0.5, color: "#cbd5e1", flex: 1 }} accentColor="#93c5fd">{b}</RichText>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
    }

    const custom = content.customSections?.find(s => s.id === id);
    if (custom && custom.items.length > 0) {
      return (
        <View key={id}>
          <Text style={{ ...sidebarLabel, marginTop: sidebarGap }}>{getSectionLabel(id, content)}</Text>
          {custom.items.map((item, i) => (
            <View key={i} style={{ marginBottom: 5 }}>
              <Text style={{ fontSize: c.fsTiny, fontFamily: ff(true), color: "#fff" }}>{item.title}</Text>
              {item.subtitle ? <Text style={{ fontSize: c.fsTiny - 0.5, color: "#94a3b8" }}>{item.subtitle}</Text> : null}
              {item.bullets.map((b, j) => (
                <View key={j} style={{ flexDirection: "row", marginBottom: 1.5 }}>
                  <Text style={{ fontSize: c.fsTiny - 0.5, color: accentColor, width: 7, flexShrink: 0 }}>›</Text>
                  <RichText style={{ fontSize: c.fsTiny - 0.5, color: "#cbd5e1", flex: 1 }} accentColor="#93c5fd">{b}</RichText>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
    }

    return null;
  }

  // ── Main area renders all section types in light-bg style ─────────────────
  const mainSections: Record<string, React.ReactNode> = {
    summary: !!content.summary && (
      <View wrap={false} key="summary" style={{ marginTop: c.secGap }}>
        <Text style={{ ...mainHeaderStyle, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingBottom: 3, marginBottom: c.headerGap }}>
          {getSectionLabel("summary", content)}
        </Text>
        <RichText style={{ fontSize: c.fsSmall, color: "#374151" }} accentColor={accentColor}>{content.summary}</RichText>
      </View>
    ),
    experience: content.experience.length > 0 && (
      <View key="experience">
        {content.experience.length > 0 ? (
          <>
            <View wrap={false} style={{ marginTop: c.secGap }}>
              <Text style={{ ...mainHeaderStyle, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingBottom: 3, marginBottom: c.headerGap }}>
                {getSectionLabel("experience", content)}
              </Text>
              <View style={{ marginBottom: content.experience.length === 1 ? 0 : c.jobGap }}>
                <View style={{ flexDirection: "row", marginBottom: 1 }}>
                  <Text style={{ flex: 1, fontSize: c.fs + 0.5, fontFamily: ff(true), color: "#111827", minWidth: 0 }}>{content.experience[0]!.title}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#9ca3af", flexShrink: 0 }}>{content.experience[0]!.duration}</Text>
                </View>
                <Text style={{ fontSize: c.fsSmall - 0.5, fontFamily: fi(), color: "#6b7280", marginBottom: 3 }}>{content.experience[0]!.company}</Text>
                {content.experience[0]!.bullets.map((b, j) => (
                  <View key={j} style={{ flexDirection: "row", marginBottom: c.bulletGap, paddingLeft: 4 }}>
                    <Text style={{ fontSize: c.fsSmall, color: accentColor, width: 10, flexShrink: 0 }}>›</Text>
                    <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#374151", minWidth: 0 }} accentColor={accentColor}>{b}</RichText>
                  </View>
                ))}
              </View>
            </View>
            {content.experience.slice(1).map((job, i, arr) => (
              <View key={i + 1} wrap={false} style={{ marginBottom: i === arr.length - 1 ? 0 : c.jobGap }}>
                <View style={{ flexDirection: "row", marginBottom: 1 }}>
                  <Text style={{ flex: 1, fontSize: c.fs + 0.5, fontFamily: ff(true), color: "#111827", minWidth: 0 }}>{job.title}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#9ca3af", flexShrink: 0 }}>{job.duration}</Text>
                </View>
                <Text style={{ fontSize: c.fsSmall - 0.5, fontFamily: fi(), color: "#6b7280", marginBottom: 3 }}>{job.company}</Text>
                {job.bullets.map((b, j) => (
                  <View key={j} style={{ flexDirection: "row", marginBottom: c.bulletGap, paddingLeft: 4 }}>
                    <Text style={{ fontSize: c.fsSmall, color: accentColor, width: 10, flexShrink: 0 }}>›</Text>
                    <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#374151", minWidth: 0 }} accentColor={accentColor}>{b}</RichText>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : (
          <Text style={{ ...mainHeaderStyle, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingBottom: 3, marginBottom: c.headerGap }}>
            {getSectionLabel("experience", content)}
          </Text>
        )}
      </View>
    ),
    education: content.education.length > 0 && (
      <View key="education">
        {content.education.length > 0 ? (
          <>
            <View wrap={false} style={{ marginTop: c.secGap }}>
              <Text style={{ ...mainHeaderStyle, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingBottom: 3, marginBottom: c.headerGap }}>
                {getSectionLabel("education", content)}
              </Text>
              <View style={{ marginBottom: content.education.length === 1 ? 0 : c.jobGap * 0.5 }}>
                <View style={{ flexDirection: "row" }}>
                  <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#111827", minWidth: 0 }}>{content.education[0]!.degree}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#9ca3af", flexShrink: 0 }}>{content.education[0]!.year}</Text>
                </View>
                <Text style={{ fontSize: c.fsSmall - 0.5, fontFamily: fi(), color: "#6b7280" }}>{content.education[0]!.institution}</Text>
              </View>
            </View>
            {content.education.slice(1).map((edu, i, arr) => (
              <View key={i + 1} wrap={false} style={{ marginBottom: i === arr.length - 1 ? 0 : c.jobGap * 0.5 }}>
                <View style={{ flexDirection: "row" }}>
                  <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#111827", minWidth: 0 }}>{edu.degree}</Text>
                  <Text style={{ fontSize: c.fsTiny, color: "#9ca3af", flexShrink: 0 }}>{edu.year}</Text>
                </View>
                <Text style={{ fontSize: c.fsSmall - 0.5, fontFamily: fi(), color: "#6b7280" }}>{edu.institution}</Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={{ ...mainHeaderStyle, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingBottom: 3, marginBottom: c.headerGap }}>
            {getSectionLabel("education", content)}
          </Text>
        )}
      </View>
    ),
    skills: flattenSkills(content).length > 0 && (
      <View wrap={false} key="skills" style={{ marginTop: c.secGap }}>
        <Text style={{ ...mainHeaderStyle, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingBottom: 3, marginBottom: c.headerGap }}>
          {getSectionLabel("skills", content)}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {flattenSkills(content).map((skill, i) => (
            <View key={i} style={{ backgroundColor: "#f1f5f9", borderRadius: 2, paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2, marginRight: 4, marginBottom: 3 }}>
              <Text style={{ fontSize: c.fsSmall, color: "#374151" }}>{skill}</Text>
            </View>
          ))}
        </View>
      </View>
    ),
  };

  return (
    <Document>
      <Page size="A4" style={{ flexDirection: "row", fontFamily: ff(), fontSize: c.fs, color: "#1f2937" }}>
        {/* Sidebar */}
        <View style={{ width: SIDEBAR_W, backgroundColor: "#1e293b", padding: sidebarPad, flexShrink: 0 }}>
          {/* Name scales with fontDelta: base 15pt + delta, min 12 */}
          <Text style={{ fontSize: Math.max(12, c.fs + 5), fontFamily: ff(true), color: "#fff", marginBottom: 2 }}>
            {content.name || "Your Name"}
          </Text>
          {content.experience[0] && getCol("experience") === "main" && (
            <Text style={{ fontSize: c.fsTiny, color: "#94a3b8", marginBottom: sidebarGap }}>
              {content.experience[0].title}
            </Text>
          )}
          {[content.contact.email, content.contact.phone, content.contact.location, content.contact.linkedin, content.contact.github, content.contact.website].some(Boolean) && (
            <View style={{ marginBottom: sidebarGap }}>
              <Text style={{ fontSize: c.fsTiny - 0.5, fontFamily: ff(true), color: accentColor, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 }}>
                Contact
              </Text>
              <ContactLinks contact={content.contact} textStyle={{ fontSize: c.fsTiny - 0.5, color: "#cbd5e1", marginBottom: 2 }} accentColor="#93c5fd" vertical />
            </View>
          )}
          {sidebarOrder.map(id => renderSidebarSection(id))}
        </View>

        {/* Main */}
        <View style={{ flex: 1, padding: mainPad, minWidth: 0 }}>
          {mainOrder.map(id => {
            if (id in mainSections) return mainSections[id] || null;
            const custom = content.customSections?.find(s => s.id === id);
            if (!custom) return null;
            return (
              <CustomSectionBlock key={id} section={custom} accentColor={accentColor}
                headerStyle={{ ...mainHeaderStyle, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingBottom: 3 }}
                headerGap={c.headerGap}
                titleStyle={{ flex: 1, fontSize: c.fs + 0.5, fontFamily: ff(true), color: "#111827" }}
                subtitleStyle={{ fontSize: c.fsTiny, color: "#9ca3af" }}
                bulletMarker="›" bulletMarkerStyle={{ fontSize: c.fsSmall, color: accentColor, width: 10, flexShrink: 0 }}
                bulletTextStyle={{ flex: 1, fontSize: c.fsSmall, color: "#374151", minWidth: 0 }}
                secGap={c.secGap} itemGap={c.jobGap} bulletGap={c.bulletGap} bulletPaddingLeft={4}
              />
            );
          })}
        </View>
      </Page>
    </Document>
  );
}
