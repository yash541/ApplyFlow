import { View, Text } from "@react-pdf/renderer";
import { RichText } from "./RichText";
import type { CustomSection } from "@/store/resumeLab";

interface Props {
  section: CustomSection;
  accentColor: string;
  // Header label style (varies per template)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  headerStyle: any;
  // Optional border container wrapping the header (Classic/Minimal use this)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  headerBorder?: any;
  headerGap: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  titleStyle: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subtitleStyle: any;
  bulletMarker: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bulletMarkerStyle: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bulletTextStyle: any;
  secGap: number;
  itemGap: number;
  bulletGap: number;
  bulletPaddingLeft?: number;
}

export function CustomSectionBlock({
  section, accentColor, headerStyle, headerBorder, headerGap,
  titleStyle, subtitleStyle,
  bulletMarker, bulletMarkerStyle, bulletTextStyle,
  secGap, itemGap, bulletGap, bulletPaddingLeft = 0,
}: Props) {
  if (section.items.length === 0) return null;
  return (
    <View>
      <>
        {/* Heading + first entry grouped — prevents orphaned heading.
            marginTop (not marginBottom on outer) so spacing re-applies on page 2. */}
        <View wrap={false} style={{ marginTop: secGap }}>
          {headerBorder ? (
            <View style={headerBorder}>
              <Text style={{ ...headerStyle, marginBottom: 3 }}>{section.label}</Text>
            </View>
          ) : (
            <Text style={{ ...headerStyle, marginBottom: headerGap }}>{section.label}</Text>
          )}
          <View style={{ marginBottom: section.items.length === 1 ? 0 : itemGap }}>
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, ...titleStyle, minWidth: 0 }}>{section.items[0]!.title}</Text>
              {section.items[0]!.subtitle ? <Text style={{ ...subtitleStyle, flexShrink: 0 }}>{section.items[0]!.subtitle}</Text> : null}
            </View>
            {section.items[0]!.bullets.map((b, j) => (
              <View key={j} style={{ flexDirection: "row", marginBottom: bulletGap, paddingLeft: bulletPaddingLeft }}>
                <Text style={bulletMarkerStyle}>{bulletMarker}</Text>
                <RichText style={bulletTextStyle} accentColor={accentColor}>{b}</RichText>
              </View>
            ))}
          </View>
        </View>
        {/* Remaining entries — each stays whole, can flow across pages */}
        {section.items.slice(1).map((item, i, arr) => (
          <View key={i + 1} wrap={false} style={{ marginBottom: i === arr.length - 1 ? 0 : itemGap }}>
            <View style={{ flexDirection: "row", marginBottom: 1 }}>
              <Text style={{ flex: 1, ...titleStyle, minWidth: 0 }}>{item.title}</Text>
              {item.subtitle ? <Text style={{ ...subtitleStyle, flexShrink: 0 }}>{item.subtitle}</Text> : null}
            </View>
            {item.bullets.map((b, j) => (
              <View key={j} style={{ flexDirection: "row", marginBottom: bulletGap, paddingLeft: bulletPaddingLeft }}>
                <Text style={bulletMarkerStyle}>{bulletMarker}</Text>
                <RichText style={bulletTextStyle} accentColor={accentColor}>{b}</RichText>
              </View>
            ))}
          </View>
        ))}
      </>
    </View>
  );
}
