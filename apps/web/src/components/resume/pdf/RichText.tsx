import { Text, Link } from "@react-pdf/renderer";
import { parseRichText } from "./shared";

interface Props {
  children: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style: any;
  accentColor: string;
  /** Bold font family — pass ff(true) from the template. Defaults to Helvetica-Bold. */
  boldFontFamily?: string;
}

export function RichText({ children, style, accentColor, boldFontFamily = "Helvetica-Bold" }: Props) {
  // overflow: hidden clips unbreakable text (no spaces) so it never crosses page boundaries
  const baseStyle = { textAlign: "justify" as const, overflow: "hidden" as const, ...style };
  const segments = parseRichText(children);

  // Fast path: single plain segment with no markup
  if (segments.length === 1 && !segments[0]?.href && !segments[0]?.bold) {
    return <Text style={baseStyle}>{children}</Text>;
  }

  return (
    <Text style={baseStyle}>
      {segments.map((seg, i) => {
        if (seg.href) {
          return (
            <Link key={i} src={seg.href}>
              <Text style={{ ...baseStyle, color: accentColor, textDecoration: "underline" }}>
                {seg.text}
              </Text>
            </Link>
          );
        }
        if (seg.bold) {
          return (
            <Text key={i} style={{ ...baseStyle, fontFamily: boldFontFamily }}>
              {seg.text}
            </Text>
          );
        }
        return <Text key={i} style={baseStyle}>{seg.text}</Text>;
      })}
    </Text>
  );
}
