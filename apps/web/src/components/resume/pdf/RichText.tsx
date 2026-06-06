import { View, Text, Link } from "@react-pdf/renderer";
import { parseRichText } from "./shared";

interface Props {
  children: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style: any;
  accentColor: string;
  boldFontFamily?: string;
}

// Insert a space every MAX_CHARS characters within long unbroken tokens so
// react-pdf can wrap them. Real resume words are never this long — only
// garbage input or very long URLs trigger this. 35 chars is the threshold
// so "internationalization" (20) and "containerization" (16) are never split.
const MAX_CHARS = 35;
function softBreak(text: string): string {
  return text.replace(/\S{36,}/g, (token) => {
    const chunks: string[] = [];
    for (let i = 0; i < token.length; i += MAX_CHARS) {
      chunks.push(token.slice(i, i + MAX_CHARS));
    }
    return chunks.join(" ");
  });
}

export function RichText({ children, style, accentColor, boldFontFamily = "Helvetica-Bold" }: Props) {
  // Pre-process text to insert break opportunities for long unbroken tokens.
  // This allows react-pdf's Yoga engine to wrap at those points instead of clipping.
  const text = softBreak(children);

  // Split layout props (go on the wrapping View) from text-specific props.
  // The wrapper View constrains the layout boundary; overflow:hidden is a
  // safety net for anything that still can't be wrapped.
  const {
    flex, minWidth, maxWidth, flexShrink, flexGrow, width,
    alignSelf, margin, marginTop, marginBottom, marginLeft, marginRight,
    ...textOnlyStyle
  } = style;

  const wrapperStyle: Record<string, unknown> = {
    overflow: "hidden",
    ...(flex !== undefined && { flex }),
    ...(minWidth !== undefined && { minWidth }),
    ...(maxWidth !== undefined && { maxWidth }),
    ...(flexShrink !== undefined && { flexShrink }),
    ...(flexGrow !== undefined && { flexGrow }),
    ...(width !== undefined && { width }),
    ...(alignSelf !== undefined && { alignSelf }),
    ...(margin !== undefined && { margin }),
    ...(marginTop !== undefined && { marginTop }),
    ...(marginBottom !== undefined && { marginBottom }),
    ...(marginLeft !== undefined && { marginLeft }),
    ...(marginRight !== undefined && { marginRight }),
  };

  const baseTextStyle = { textAlign: "left" as const, ...textOnlyStyle };
  const segments = parseRichText(text);

  const textContent =
    segments.length === 1 && !segments[0]?.href && !segments[0]?.bold ? (
      <Text style={baseTextStyle}>{text}</Text>
    ) : (
      <Text style={baseTextStyle}>
        {segments.map((seg, i) => {
          if (seg.href) {
            return (
              <Link key={i} src={seg.href}>
                <Text style={{ ...baseTextStyle, color: accentColor, textDecoration: "underline" }}>
                  {seg.text}
                </Text>
              </Link>
            );
          }
          if (seg.bold) {
            return (
              <Text key={i} style={{ ...baseTextStyle, fontFamily: boldFontFamily }}>
                {seg.text}
              </Text>
            );
          }
          return <Text key={i} style={baseTextStyle}>{seg.text}</Text>;
        })}
      </Text>
    );

  return <View style={wrapperStyle}>{textContent}</View>;
}
