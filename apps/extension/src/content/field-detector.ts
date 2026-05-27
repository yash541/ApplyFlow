import type { DetectedField, FieldKind } from "@applyflow/shared";

// ── Classification rules ──────────────────────────────────────────────────────

type Rule = { kind: FieldKind; patterns: RegExp[] };

const RULES: Rule[] = [
  // Identity
  { kind: "email",       patterns: [/\bemail\b/i, /\be-mail\b/i] },
  { kind: "phone",       patterns: [/\bphone\b/i, /\bmobile\b/i, /\btelephone\b/i, /\btel\b/i, /\bcontact.?num/i] },
  { kind: "full_name",   patterns: [/\bfull.?name\b/i, /\byour.?name\b/i, /\bname\b/i] },
  { kind: "first_name",  patterns: [/\bfirst.?name\b/i, /\bgiven.?name\b/i, /\bforename\b/i] },
  { kind: "last_name",   patterns: [/\blast.?name\b/i, /\bsurname\b/i, /\bfamily.?name\b/i] },
  // Location
  { kind: "location",    patterns: [/\blocation\b/i, /\bcurrent.?location\b/i, /\baddress\b/i] },
  { kind: "city",        patterns: [/\bcity\b/i, /\btown\b/i] },
  { kind: "state",       patterns: [/\bstate\b/i, /\bprovince\b/i, /\bregion\b/i] },
  { kind: "country",     patterns: [/\bcountry\b/i] },
  { kind: "zip",         patterns: [/\bzip\b/i, /\bpostal.?code\b/i, /\bpostcode\b/i] },
  // Social / URLs
  { kind: "linkedin",    patterns: [/\blinkedin\b/i, /linkedin\.com/i] },
  { kind: "github",      patterns: [/\bgithub\b/i, /github\.com/i] },
  { kind: "website",     patterns: [/\bwebsite\b/i, /\bportfolio\b/i, /\bpersonal.?url\b/i, /\bhomepage\b/i] },
  // Professional
  { kind: "headline",    patterns: [/\bheadline\b/i, /\bcurrent.?title\b/i, /\bjob.?title\b/i] },
  { kind: "summary",     patterns: [/\bsummary\b/i, /\bcover.?letter\b/i, /\babout.?you\b/i, /\bbio\b/i, /\bdescribe.?yourself\b/i, /\bprofessional.?statement\b/i] },
  // Application Q&A
  { kind: "work_auth",         patterns: [/\bwork.?auth\b/i, /\bauthorized.?to.?work\b/i, /\blegal.?right\b/i, /\beligib.+work\b/i, /\bwork.?eligib\b/i] },
  { kind: "requires_sponsorship", patterns: [/\bsponsor\b/i, /\bvisa.?sponsor\b/i, /\brequire.+sponsor\b/i] },
  { kind: "salary",            patterns: [/\bsalary\b/i, /\bcompensation\b/i, /\bpay.?expect\b/i, /\bexpected.?pay\b/i, /\bdesired.?salary\b/i] },
  { kind: "years_experience",  patterns: [/\byears?.?of.?exp\b/i, /\byears?.?exp\b/i, /\bexp.+years\b/i] },
  { kind: "notice_period",     patterns: [/\bnotice.?period\b/i, /\bnotice\b/i, /\bavailability\b/i, /\bwhen.+start\b/i, /\bstart.?date\b/i] },
  { kind: "remote_preference", patterns: [/\bremote\b/i, /\bhybrid\b/i, /\bwork.+arrangement\b/i, /\bwork.+type\b/i] },
  { kind: "willing_to_relocate", patterns: [/\brelocat\b/i, /\bwilling.+move\b/i] },
  // EEO
  { kind: "gender",     patterns: [/\bgender\b/i] },
  { kind: "ethnicity",  patterns: [/\bethnicit\b/i, /\brace\b/i, /\bracial.?origin\b/i] },
  { kind: "disability", patterns: [/\bdisabilit\b/i] },
  { kind: "veteran",    patterns: [/\bveteran\b/i, /\bmilitar\b/i, /\bprotect.+veteran\b/i] },
  // File
  { kind: "resume_file", patterns: [/\bresume\b/i, /\bcurriculum.?vitae\b/i, /\b\bcv\b\b/i, /\bupload.+doc\b/i] },
];

// ── Label extraction ──────────────────────────────────────────────────────────

function extractLabel(el: HTMLElement): string {
  const inputType = (el as HTMLInputElement).type?.toLowerCase();

  // Radio buttons: label[for] returns the option text ("Yes"/"No"), not the question.
  // Instead walk up the tree to find the question label from a fieldset legend or sibling heading.
  if (inputType === "radio") {
    const legend = el.closest("fieldset")?.querySelector("legend");
    if (legend) return legend.innerText.trim();
    // Walk up to 5 levels to find a preceding label-like sibling (LinkedIn's aria-less structure)
    let node: HTMLElement | null = el.parentElement;
    for (let depth = 0; depth < 5 && node; depth++, node = node.parentElement) {
      const sibs = Array.from(node.parentElement?.children ?? []);
      const idx = sibs.indexOf(node);
      for (let i = idx - 1; i >= 0; i--) {
        const sib = sibs[i] as HTMLElement;
        if (["LABEL", "SPAN", "DIV", "P", "LEGEND", "H3", "H4"].includes(sib.tagName)) {
          const text = sib.innerText?.trim();
          if (text && text.length > 4 && text.length < 150) return text;
        }
      }
    }
    // aria-label / aria-labelledby on the input itself
    const ariaL = el.getAttribute("aria-label");
    if (ariaL) return ariaL.trim();
    const lblBy = el.getAttribute("aria-labelledby");
    if (lblBy) {
      const t = lblBy.split(" ").map((id) => document.getElementById(id)?.innerText ?? "").join(" ").trim();
      if (t) return t;
    }
    // Last resort: name attribute
    const nm = (el as HTMLInputElement).name ?? "";
    return nm.replace(/[_\-]/g, " ").trim();
  }

  // 1. <label for="id">
  if (el.id) {
    const lbl = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl) return lbl.innerText.trim();
  }
  // 2. Wrapping <label>
  const wrapping = el.closest("label");
  if (wrapping) return wrapping.innerText.replace((el as HTMLInputElement).value ?? "", "").trim();

  // 3. aria-label / aria-labelledby
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const parts = labelledBy.split(" ").map((id) => document.getElementById(id)?.innerText ?? "");
    const joined = parts.join(" ").trim();
    if (joined) return joined;
  }

  // 4. Nearest preceding sibling / parent text (e.g. Workday <div> labels)
  const parent = el.parentElement;
  if (parent) {
    // Check for a label-like sibling that comes before the field
    const sibs = Array.from(parent.children);
    const idx = sibs.indexOf(el);
    for (let i = idx - 1; i >= 0; i--) {
      const sib = sibs[i] as HTMLElement;
      if (["LABEL", "SPAN", "DIV", "P", "LEGEND"].includes(sib.tagName)) {
        const text = sib.innerText?.trim();
        if (text && text.length < 120) return text;
      }
    }
    // Fieldset legend
    const legend = el.closest("fieldset")?.querySelector("legend");
    if (legend) return legend.innerText.trim();
  }

  // 5. placeholder / name / id as last resort
  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder) return placeholder.trim();
  const name = el.getAttribute("name") ?? el.id ?? "";
  return name.replace(/[_\-]/g, " ").trim();
}

// ── Classifier ────────────────────────────────────────────────────────────────

function classify(el: HTMLElement, label: string): { kind: FieldKind; confidence: number } {
  const inputType = (el as HTMLInputElement).type?.toLowerCase() ?? "";

  // Hard type signals
  if (inputType === "email") return { kind: "email", confidence: 1.0 };
  if (inputType === "tel")   return { kind: "phone", confidence: 0.9 };
  if (inputType === "file")  return { kind: "resume_file", confidence: 0.8 };
  if (inputType === "hidden") return { kind: "unknown", confidence: 0 };

  // Build signal text: label + name attr + id + placeholder
  const name        = el.getAttribute("name") ?? "";
  const id          = el.id ?? "";
  const placeholder = (el as HTMLInputElement).placeholder ?? "";
  const signal      = [label, name, id, placeholder].join(" ");

  for (const rule of RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(signal)) {
        // Reward stronger matches (label > name/id > placeholder)
        const inLabel = pat.test(label) ? 0.2 : 0;
        return { kind: rule.kind, confidence: Math.min(0.95, 0.7 + inLabel) };
      }
    }
  }

  // Textarea fallback — likely a cover letter / long answer
  if (el.tagName === "TEXTAREA") return { kind: "summary", confidence: 0.3 };

  return { kind: "unknown", confidence: 0 };
}

// ── Selector builder ──────────────────────────────────────────────────────────

function buildSelector(el: HTMLElement): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const name = el.getAttribute("name");
  if (name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  // Structural: tag + nth-of-type among siblings
  const parent = el.parentElement;
  if (!parent) return el.tagName.toLowerCase();
  const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
  const idx = siblings.indexOf(el) + 1;
  return `${buildSelector(parent as HTMLElement) } > ${el.tagName.toLowerCase()}:nth-of-type(${idx})`;
}

// ── Visibility check ─────────────────────────────────────────────────────────

function isVisible(el: HTMLElement): boolean {
  const inputType = (el as HTMLInputElement).type?.toLowerCase();
  // File and radio inputs are often hidden by ATS/LinkedIn with opacity:0 or 0×0 sizing.
  // File inputs are filled via DataTransfer; radio inputs via fillRadio() — both work programmatically.
  if (inputType === "file" || inputType === "radio") return true;

  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function scanFields(root: ParentNode = document): DetectedField[] {
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>("input, textarea, select"),
  ).filter((el) => {
    const type = (el as HTMLInputElement).type?.toLowerCase();
    return type !== "hidden" && type !== "submit" && type !== "button" &&
           type !== "reset"  && type !== "checkbox" && type !== "image" &&
           isVisible(el);
  });

  const seen = new Set<string>();
  const seenRadioGroups = new Set<string>(); // deduplicate radio groups by name
  const fields: DetectedField[] = [];

  for (const el of candidates) {
    // For radio inputs: only process the first input in each name group.
    // fillRadio() queries the whole group by name, so one representative is enough.
    if ((el as HTMLInputElement).type?.toLowerCase() === "radio") {
      const name = (el as HTMLInputElement).name ?? "";
      if (!name || seenRadioGroups.has(name)) continue;
      seenRadioGroups.add(name);
    }

    const selector = buildSelector(el);
    if (seen.has(selector)) continue;
    seen.add(selector);

    const label = extractLabel(el);
    const { kind, confidence } = classify(el, label);

    fields.push({
      uid: crypto.randomUUID(),
      kind,
      confidence,
      inputType: (el as HTMLInputElement).type ?? el.tagName.toLowerCase(),
      label: label || "(no label)",
      selector,
    });
  }

  return fields;
}
