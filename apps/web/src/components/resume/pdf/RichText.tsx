import { View, Text, Link } from "@react-pdf/renderer";
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
  // Split layout props (go on the wrapping View) from text props (go on the Text).
  // Wrapping in a View with overflow:hidden is the only reliable way in react-pdf's
  // Yoga engine to prevent long unbroken strings from crossing page/column margins.
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

  const baseTextStyle = { textAlign: "justify" as const, ...textOnlyStyle };
  const segments = parseRichText(children);

  const textContent = segments.length === 1 && !segments[0]?.href && !segments[0]?.bold
    ? <Text style={baseTextStyle}>{children}</Text>
    : (
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
