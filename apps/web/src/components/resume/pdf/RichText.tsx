import { Text, Link } from "@react-pdf/renderer";
import { parseInlineLinks } from "./shared";

interface Props {
  children: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style: any;
  accentColor: string;
}

export function RichText({ children, style, accentColor }: Props) {
  const baseStyle = { textAlign: "justify" as const, ...style };
  const segments = parseInlineLinks(children);
  if (segments.length === 1 && !segments[0]?.href) {
    return <Text style={baseStyle}>{children}</Text>;
  }
  return (
    <Text style={baseStyle}>
      {segments.map((seg, i) =>
        seg.href ? (
          <Link key={i} src={seg.href}>
            <Text style={{ ...baseStyle, color: accentColor, textDecoration: "underline" }}>{seg.text}</Text>
          </Link>
        ) : (
          <Text key={i} style={baseStyle}>{seg.text}</Text>
        )
      )}
    </Text>
  );
}
