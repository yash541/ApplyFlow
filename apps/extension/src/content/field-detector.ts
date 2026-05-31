import type { ScrapedField } from "@applyflow/shared";

// ── Generic hint filter ───────────────────────────────────────────────────────
// Strings that are UI hints, not real question text.

const GENERIC_HINTS = new Set([
  "your answer", "enter your answer", "type your answer",
  "type here", "enter here", "enter text", "enter value",
  "type your response", "enter your response", "your response",
  "answer", "response", "write here", "add your answer",
  "please type your answer", "please enter", "start typing",
  "write your answer", "add a comment", "add comment",
]);

function isGenericHint(t: string): boolean {
  return GENERIC_HINTS.has(t.toLowerCase().trim().replace(/\s+/g, " "));
}

// ── Attribute normalisation ───────────────────────────────────────────────────
// camelCase / snake_case / bracket-notation → spaced words.
// Used as a last-resort label when no visible text is found.

function normaliseAttr(raw: string): string {
  const m = raw.match(/\[([^\]]+)\]$/);
  const token = m ? m[1]! : raw;
  return token
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]/g, " ")
    .toLowerCase()
    .trim();
}

// ── Question extraction ───────────────────────────────────────────────────────
// Returns the human-readable question text for a form element.

function extractQuestion(el: HTMLElement): string {
  const type = (el as HTMLInputElement).type?.toLowerCase();

  // Radio: question is in a fieldset legend or a heading ancestor
  if (type === "radio") {
    const legend = el.closest("fieldset")?.querySelector("legend");
    if (legend) return legend.innerText.trim();

    let node: HTMLElement | null = el.parentElement;
    for (let d = 0; d < 10 && node; d++, node = node.parentElement) {
      const sibs = Array.from(node.parentElement?.children ?? []);
      const idx  = sibs.indexOf(node);
      for (let i = idx - 1; i >= 0; i--) {
        const sib = sibs[i] as HTMLElement;
        if (["LABEL","SPAN","DIV","P","H1","H2","H3","H4","H5","LEGEND"].includes(sib.tagName)) {
          const text = sib.innerText?.trim();
          if (text && text.length > 3 && text.length < 200 && !isGenericHint(text)) return text;
        }
      }
    }
    return el.getAttribute("aria-label")?.trim() ?? "";
  }

  // 1. <label for="id">
  if (el.id) {
    const lbl = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl) return lbl.innerText.trim();
  }

  // 2. Wrapping <label>
  const wrap = el.closest("label");
  if (wrap) {
    const text = wrap.innerText.replace((el as HTMLInputElement).value ?? "", "").trim();
    if (text) return text;
  }

  // 3. aria-label / aria-labelledby
  const al = el.getAttribute("aria-label");
  if (al && !isGenericHint(al)) return al.trim();

  const alby = el.getAttribute("aria-labelledby");
  if (alby) {
    const text = alby.split(" ")
      .map(id => document.getElementById(id)?.innerText ?? "")
      .join(" ").trim();
    if (text && !isGenericHint(text)) return text;
  }

  // 4. Preceding sibling text (Workday, Dayforce, etc.)
  const parent = el.parentElement;
  if (parent) {
    const sibs = Array.from(parent.children);
    const idx  = sibs.indexOf(el);
    for (let i = idx - 1; i >= 0; i--) {
      const sib = sibs[i] as HTMLElement;
      if (["LABEL","SPAN","DIV","P","LEGEND"].includes(sib.tagName)) {
        const text = sib.innerText?.trim();
        if (text && text.length < 200 && !isGenericHint(text)) return text;
      }
    }
    const legend = el.closest("fieldset")?.querySelector("legend");
    if (legend) return legend.innerText.trim();
  }

  // 5. Non-generic placeholder
  const ph = (el as HTMLInputElement).placeholder ?? "";
  if (ph && !isGenericHint(ph)) return ph.trim();

  // 6. name / id attribute as readable words
  const name = el.getAttribute("name") ?? "";
  if (name && !name.startsWith("entry.")) return normaliseAttr(name);
  if (el.id && !/^\d/.test(el.id)) return normaliseAttr(el.id);

  return "";
}

// ── Options extraction ────────────────────────────────────────────────────────
// For radio groups and <select> elements, collect all choice texts.

function extractOptions(el: HTMLElement): string[] {
  if (el.tagName === "SELECT") {
    return Array.from((el as HTMLSelectElement).options)
      .filter(o => o.value !== "" && !isGenericHint(o.text))
      .map(o => o.text.trim())
      .filter(Boolean);
  }

  if ((el as HTMLInputElement).type?.toLowerCase() === "radio") {
    const name = (el as HTMLInputElement).name;
    if (!name) return [];
    return Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`)
    ).map(r => {
      const lbl = r.id
        ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(r.id)}"]`)
        : null;
      return (
        lbl?.innerText ??
        r.closest("label")?.innerText ??
        r.getAttribute("aria-label") ??
        r.value ?? ""
      ).trim();
    }).filter(Boolean);
  }

  return [];
}

// ── Selector builder ──────────────────────────────────────────────────────────

function buildSelector(el: HTMLElement): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const name = el.getAttribute("name");
  if (name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  const parent = el.parentElement;
  if (!parent) return el.tagName.toLowerCase();
  const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
  const idx = siblings.indexOf(el) + 1;
  return `${buildSelector(parent as HTMLElement)} > ${el.tagName.toLowerCase()}:nth-of-type(${idx})`;
}

// ── Visibility ────────────────────────────────────────────────────────────────

function isVisible(el: HTMLElement): boolean {
  const type = (el as HTMLInputElement).type?.toLowerCase();
  if (type === "file" || type === "radio") return true; // filled programmatically
  const s = window.getComputedStyle(el);
  if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Scan all fillable form fields on the page and return a flat list of
 * ScrapedField — one per logical question (radio groups deduplicated).
 *
 * The detector does NOT classify fields or suggest answers.
 * It only extracts the question text and available options.
 */
export function scanFields(root: ParentNode = document): ScrapedField[] {
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>("input, textarea, select"),
  ).filter(el => {
    const type = (el as HTMLInputElement).type?.toLowerCase();
    return type !== "hidden" && type !== "submit" && type !== "button" &&
           type !== "reset"  && type !== "checkbox" && type !== "image" &&
           isVisible(el);
  });

  const seen            = new Set<string>();
  const seenRadioGroups = new Set<string>();
  const fields: ScrapedField[] = [];

  for (const el of candidates) {
    const type = (el as HTMLInputElement).type?.toLowerCase();

    // Deduplicate radio groups — one representative per question
    if (type === "radio") {
      const name = (el as HTMLInputElement).name ?? "";
      const key  = name || buildSelector(el);
      if (seenRadioGroups.has(key)) continue;
      seenRadioGroups.add(key);
    }

    const selector = buildSelector(el);
    if (seen.has(selector)) continue;
    seen.add(selector);

    let fieldType = type || el.tagName.toLowerCase();
    if (el.tagName === "SELECT")   fieldType = "select";
    if (el.tagName === "TEXTAREA") fieldType = "textarea";

    fields.push({
      uid:       crypto.randomUUID(),
      question:  extractQuestion(el) || "(no label)",
      fieldType,
      options:   extractOptions(el),
      selector,
    });
  }

  return fields;
}
