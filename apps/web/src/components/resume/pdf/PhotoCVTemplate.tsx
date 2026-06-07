import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import {
  fontFamily, fontItalic, makeConfig, DEFAULT_SECTION_ORDER,
  getSectionLabel, flattenSkills, type TemplateProps,
} from "./shared";
import { RichText } from "./RichText";

// ── PhotoCV Template ──────────────────────────────────────────────────────────
// Two-column layout: dark sidebar (left) + white main (right)
// Matching reference: circular photo, accent-colored timeline dots, split name
//
// Sidebar sections (fixed): Photo, Contact, Education, Skills
// Main sections (from sectionOrder): Summary, Experience, Projects, Certifications, custom
//
// Core functionality unchanged: sectionOrder, wrap={false}, compact, layout,
// fontStyle, projects, certifications, custom sections all work identically.
// ─────────────────────────────────────────────────────────────────────────────

export function PhotoCVTemplate({
  content, accentColor, fontStyle, compact, layout = {}, sectionOrder = DEFAULT_SECTION_ORDER,
}: TemplateProps) {
  const ff  = (bold = false) => fontFamily(fontStyle, bold);
  const fi  = () => fontItalic(fontStyle);
  const c   = makeConfig(compact, layout);

  const SIDEBAR_W   = compact ? 148 : 172;
  const PHOTO_SIZE  = compact ? 68 : 84;
  const SIDEBAR_BG  = "#1b2a47";
  const sidebarPadH = compact ? 14 : 18;
  const sidebarPadV = compact ? 18 : 24;
  const mainPadH    = compact ? 18 : 24;

  // Sidebar text styles
  const sidebarLabel = {
    fontFamily: ff(true),
    fontSize: c.fsTiny + 0.5,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    color: accentColor,
    marginBottom: 1,
  };
  const sidebarText = { fontSize: c.fsTiny, color: "#cbd5e1" };

  // Main section header (accent text + full-width thin rule)
  const mainLabel = {
    fontFamily: ff(true),
    fontSize: c.fs + 1,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    color: accentColor,
  };

  // Main section header
  function MainHeader({ id }: { id: string }) {
    return (
      <View style={{ marginBottom: compact ? 6 : 8 }}>
        <Text style={mainLabel}>{getSectionLabel(id, content)}</Text>
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#d1d5db", marginTop: 2 }} />
      </View>
    );
  }

  // Timeline dot for experience entries
  function TimelineDot() {
    return (
      <View style={{ width: 14, paddingTop: 2, flexShrink: 0, alignItems: "center" }}>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: accentColor }} />
      </View>
    );
  }

  // Name split: first word bold, rest regular — both uppercase
  const nameParts   = (content.name || "Your Name").split(" ");
  const firstName   = nameParts[0] ?? "";
  const lastName    = nameParts.slice(1).join(" ");

  // Contact items for sidebar
  const contactItems = [
    content.contact.phone && { icon: "📞", text: content.contact.phone },
    content.contact.email && { icon: "✉", text: content.contact.email },
    content.contact.location && { icon: "📍", text: content.contact.location },
    content.contact.linkedin && { icon: "🔗", text: content.contact.linkedin },
    content.contact.github && { icon: "⌨", text: content.contact.github },
    content.contact.website && { icon: "🌐", text: content.contact.website },
  ].filter(Boolean) as { icon: string; text: string }[];

  // Sections that live in the main content area (everything except sidebar-specific)
  const sidebarIds  = new Set(["education", "skills"]);
  const mainOrder   = sectionOrder.filter(id => !sidebarIds.has(id));

  // ── Main section definitions ───────────────────────────────────────────────

  function renderMainSection(id: string): React.ReactNode {
    if (id === "summary" && content.summary) {
      return (
        <View key="summary" wrap={false} style={{ marginBottom: c.secGap }}>
          <MainHeader id="summary" />
          <RichText style={{ fontSize: c.fsSmall, color: "#374151", textAlign: "justify" }} accentColor={accentColor}>
            {content.summary}
          </RichText>
        </View>
      );
    }

    if (id === "experience" && content.experience.length > 0) {
      return (
        <View key="experience" style={{ marginBottom: c.secGap }}>
          {content.experience.map((job, i) => (
            <View key={i} wrap={false} style={{ marginBottom: i < content.experience.length - 1 ? c.jobGap : 0 }}>
              {i === 0 && <MainHeader id="experience" />}
              {/* Timeline dot + entry */}
              <View style={{ flexDirection: "row" }}>
                <TimelineDot />
                <View style={{ flex: 1, minWidth: 0 }}>
                  {/* Company (bold L) + Duration (R) */}
                  <View style={{ flexDirection: "row", marginBottom: 1 }}>
                    <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#111827", minWidth: 0 }}>
                      {job.company}
                    </Text>
                    <Text style={{ fontSize: c.fsTiny, color: "#6b7280", flexShrink: 0, textTransform: "uppercase" as const }}>
                      {job.duration}
                    </Text>
                  </View>
                  {/* Job title italic */}
                  <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#6b7280", marginBottom: compact ? 3 : 4 }}>
                    {job.title}
                  </Text>
                  {job.bullets.map((b, j) => (
                    <View key={j} style={{ flexDirection: "row", marginBottom: c.bulletGap }}>
                      <Text style={{ fontSize: c.fs, color: "#374151", width: 12, flexShrink: 0 }}>•</Text>
                      <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#374151", minWidth: 0, textAlign: "justify" }} accentColor={accentColor}>
                        {b}
                      </RichText>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (id === "projects" && (content.projects?.length ?? 0) > 0) {
      return (
        <View key="projects" style={{ marginBottom: c.secGap }}>
          {content.projects!.map((proj, i) => (
            <View key={i} wrap={false} style={{ marginBottom: i < content.projects!.length - 1 ? c.jobGap : 0 }}>
              {i === 0 && <MainHeader id="projects" />}
              <View style={{ flexDirection: "row" }}>
                <TimelineDot />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", marginBottom: 1 }}>
                    <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#111827", minWidth: 0 }}>
                      {proj.name}
                    </Text>
                  </View>
                  {proj.tech && proj.tech.length > 0 && (
                    <Text style={{ fontFamily: fi(), fontSize: c.fsTiny, color: "#6b7280", marginBottom: 2 }}>
                      {proj.tech.join(" · ")}
                    </Text>
                  )}
                  {proj.bullets.map((b, j) => (
                    <View key={j} style={{ flexDirection: "row", marginBottom: c.bulletGap }}>
                      <Text style={{ fontSize: c.fs, color: "#374151", width: 12, flexShrink: 0 }}>•</Text>
                      <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#374151", minWidth: 0 }} accentColor={accentColor}>
                        {b}
                      </RichText>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (id === "certifications" && (content.certifications?.length ?? 0) > 0) {
      return (
        <View key="certifications" style={{ marginBottom: c.secGap }}>
          {content.certifications!.map((cert, i) => (
            <View key={i} wrap={false} style={{ marginBottom: i < content.certifications!.length - 1 ? c.jobGap * 0.6 : 0 }}>
              {i === 0 && <MainHeader id="certifications" />}
              <View style={{ flexDirection: "row", marginBottom: 1 }}>
                <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#111827", minWidth: 0 }}>{cert.name}</Text>
                {cert.date && <Text style={{ fontSize: c.fsTiny, color: "#6b7280", flexShrink: 0 }}>{cert.date}</Text>}
              </View>
              <Text style={{ fontFamily: fi(), fontSize: c.fsSmall, color: "#6b7280" }}>{cert.issuer}</Text>
            </View>
          ))}
        </View>
      );
    }

    // Custom sections
    const custom = content.customSections?.find(s => s.id === id);
    if (!custom || custom.items.length === 0) return null;
    return (
      <View key={id} style={{ marginBottom: c.secGap }}>
        {custom.items.map((item, idx) => (
          <View key={idx} wrap={false} style={{ marginBottom: idx < custom.items.length - 1 ? c.jobGap : 0 }}>
            {idx === 0 && <MainHeader id={id} />}
            <View style={{ flexDirection: "row" }}>
              <TimelineDot />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", marginBottom: 1 }}>
                  <Text style={{ flex: 1, fontFamily: ff(true), fontSize: c.fs, color: "#111827", minWidth: 0 }}>{item.title}</Text>
                  {item.subtitle && <Text style={{ fontSize: c.fsTiny, color: "#6b7280", flexShrink: 0 }}>{item.subtitle}</Text>}
                </View>
                {item.bullets.map((b, j) => (
                  <View key={j} style={{ flexDirection: "row", marginBottom: c.bulletGap }}>
                    <Text style={{ fontSize: c.fs, color: "#374151", width: 12, flexShrink: 0 }}>•</Text>
                    <RichText style={{ flex: 1, fontSize: c.fsSmall, color: "#374151", minWidth: 0 }} accentColor={accentColor}>{b}</RichText>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  }

  // ── Page ──────────────────────────────────────────────────────────────────

  return (
    <Document>
      <Page size="A4" style={{ flexDirection: "row", fontFamily: ff(), fontSize: c.fs, color: "#000", paddingTop: sidebarPadV, paddingBottom: sidebarPadV }}>

        {/* ── Sidebar background (fixed, full bleed) */}
        <View fixed style={{ position: "absolute", top: -sidebarPadV, left: 0, width: SIDEBAR_W, height: 842, backgroundColor: SIDEBAR_BG }} />

        {/* ── Sidebar content ───────────────────────────────────────────────── */}
        <View style={{ width: SIDEBAR_W, paddingLeft: sidebarPadH, paddingRight: sidebarPadH, flexShrink: 0 }}>

          {/* Profile photo */}
          {content.photo ? (
            <View style={{ alignItems: "center", marginBottom: compact ? 12 : 18 }}>
              <View style={{ width: PHOTO_SIZE + 4, height: PHOTO_SIZE + 4, borderRadius: (PHOTO_SIZE + 4) / 2, borderWidth: 2, borderColor: accentColor, alignItems: "center", justifyContent: "center" }}>
                <Image src={content.photo} style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2 }} />
              </View>
            </View>
          ) : (
            <View style={{ alignItems: "center", marginBottom: compact ? 12 : 18 }}>
              <View style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)" }} />
            </View>
          )}

          {/* Contact */}
          {contactItems.length > 0 && (
            <>
              <View style={{ marginTop: compact ? 0 : 0, marginBottom: compact ? 6 : 8 }}>
                <Text style={sidebarLabel}>CONTACT</Text>
                <View style={{ width: 28, height: 1.5, backgroundColor: accentColor, marginTop: 2 }} />
              </View>
              {contactItems.map((item, i) => (
                <View key={i} style={{ flexDirection: "row", marginBottom: compact ? 3 : 4, alignItems: "flex-start" }}>
                  <Text style={{ width: 14, flexShrink: 0, fontSize: c.fsTiny, color: "#94a3b8" }}>{item.icon}</Text>
                  <Text style={{ ...sidebarText, flex: 1, minWidth: 0 }}>{item.text}</Text>
                </View>
              ))}
            </>
          )}

          {/* Education */}
          {content.education.length > 0 && sectionOrder.includes("education") && (
            <>
              <View style={{ marginTop: compact ? 12 : 16, marginBottom: compact ? 6 : 8 }}>
                <Text style={sidebarLabel}>{getSectionLabel("education", content)}</Text>
                <View style={{ width: 28, height: 1.5, backgroundColor: accentColor, marginTop: 2 }} />
              </View>
              {content.education.map((edu, i) => (
                <View key={i} wrap={false} style={{ marginBottom: i < content.education.length - 1 ? (compact ? 8 : 10) : 0 }}>
                  <Text style={{ fontSize: c.fsTiny, color: "#94a3b8" }}>{edu.year}</Text>
                  <Text style={{ fontFamily: ff(true), fontSize: c.fsTiny + 0.5, color: "#fff", textTransform: "uppercase" as const, marginBottom: 1 }}>
                    {edu.institution}
                  </Text>
                  <View style={{ flexDirection: "row", marginBottom: 1 }}>
                    <Text style={{ fontSize: c.fsTiny, color: "#000", width: 8, flexShrink: 0 }}>•</Text>
                    <Text style={{ ...sidebarText, flex: 1 }}>{edu.degree}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Skills */}
          {flattenSkills(content).length > 0 && sectionOrder.includes("skills") && (
            <>
              <View style={{ marginTop: compact ? 12 : 16, marginBottom: compact ? 6 : 8 }}>
                <Text style={sidebarLabel}>{getSectionLabel("skills", content)}</Text>
                <View style={{ width: 28, height: 1.5, backgroundColor: accentColor, marginTop: 2 }} />
              </View>
              {flattenSkills(content).map((skill, i) => (
                <View key={i} style={{ flexDirection: "row", marginBottom: compact ? 2 : 3 }}>
                  <Text style={{ fontSize: c.fsTiny, color: "#94a3b8", width: 8, flexShrink: 0 }}>•</Text>
                  <Text style={{ ...sidebarText, flex: 1 }}>{skill}</Text>
                </View>
              ))}
            </>
          )}

        </View>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <View style={{ flex: 1, paddingLeft: mainPadH, paddingRight: compact ? 16 : 20, minWidth: 0 }}>

          {/* Name: FIRSTNAME (bold) LASTNAME (regular) */}
          <View style={{ marginBottom: compact ? 2 : 3 }}>
            <Text style={{ fontSize: compact ? 18 : 22, color: "#111827" }}>
              <Text style={{ fontFamily: ff(true) }}>{firstName.toUpperCase()} </Text>
              <Text style={{ fontFamily: ff(false) }}>{lastName.toUpperCase()}</Text>
            </Text>
          </View>

          {/* Title (from experience[0]) + short accent bar */}
          {content.experience[0]?.title && (
            <View style={{ marginBottom: compact ? 14 : 18 }}>
              <Text style={{ fontSize: c.fsSmall, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: 1 }}>
                {content.experience[0].title}
              </Text>
              <View style={{ width: 40, height: 2.5, backgroundColor: accentColor, marginTop: compact ? 4 : 6 }} />
            </View>
          )}

          {/* Sections */}
          {mainOrder.map(id => renderMainSection(id))}

        </View>

      </Page>
    </Document>
  );
}
