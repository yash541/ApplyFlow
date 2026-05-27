import { View, Text, Link } from "@react-pdf/renderer";
import { toHref, parseInlineLinks } from "./shared";
import type { TailoredContent } from "@/store/resumeLab";

// Resolves a contact value: markdown [text](url) takes priority, else auto-detect href
function resolve(item: string): { display: string; href?: string } {
  const segs = parseInlineLinks(item);
  if (segs.length === 1 && segs[0]?.href) {
    return { display: segs[0].text, href: segs[0].href };
  }
  return { display: item, href: toHref(item) };
}

interface Props {
  contact: TailoredContent["contact"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  textStyle: any;
  accentColor: string;
  vertical?: boolean;
}

export function ContactLinks({ contact, textStyle, accentColor, vertical = false }: Props) {
  const items = [
    contact.email,
    contact.phone,
    contact.location,
    contact.linkedin,
    contact.github,
    contact.website,
  ].filter((v): v is string => !!v?.trim());

  if (items.length === 0) return null;

  if (vertical) {
    return (
      <>
        {items.map((item, i) => {
          const { display, href } = resolve(item);
          return href ? (
            <Link key={i} src={href} style={{ textDecoration: "none" }}>
              <Text style={{ ...textStyle, color: accentColor }}>{display}</Text>
            </Link>
          ) : (
            <Text key={i} style={textStyle}>{display}</Text>
          );
        })}
      </>
    );
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {items.map((item, i) => {
        const { display, href } = resolve(item);
        return (
          <View key={i} style={{ flexDirection: "row" }}>
            {i > 0 && <Text style={textStyle}>{"  ·  "}</Text>}
            {href ? (
              <Link src={href} style={{ textDecoration: "none" }}>
                <Text style={{ ...textStyle, color: accentColor }}>{display}</Text>
              </Link>
            ) : (
              <Text style={textStyle}>{display}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
