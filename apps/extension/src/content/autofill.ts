import { scanFields } from "./field-detector";
import { showSignInPanel } from "./signin-panel";
import type { DetectedField, FieldMatch } from "@applyflow/shared";

const AF_ID = "applyflow-autofill";

// ── Styles ────────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById(`${AF_ID}-styles`)) return;
  const style = document.createElement("style");
  style.id = `${AF_ID}-styles`;
  style.textContent = `
    #${AF_ID}-badge {
      position: fixed; right: 0; top: 50%; transform: translateY(-50%);
      z-index: 2147483647; display: flex; align-items: center;
      background: #6366f1; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      border-radius: 12px 0 0 12px;
      box-shadow: -3px 0 16px rgba(99,102,241,0.4);
      cursor: pointer; user-select: none; overflow: hidden;
      max-width: 52px; transition: max-width 0.25s ease, box-shadow 0.15s;
    }
    #${AF_ID}-badge:hover { max-width: 190px; box-shadow: -5px 0 24px rgba(99,102,241,0.55); }
    #${AF_ID}-badge .af-tab-icon {
      width: 52px; height: 68px; flex-shrink: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    }
    #${AF_ID}-badge .af-tab-icon span { font-size: 18px; line-height: 1; }
    #${AF_ID}-badge .af-tab-cnt {
      font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.25);
      border-radius: 10px; padding: 1px 6px; line-height: 1.4; font-family: inherit;
    }
    #${AF_ID}-badge .af-tab-lbl {
      font-size: 12px; font-weight: 600; white-space: nowrap;
      padding-right: 18px; opacity: 0; transition: opacity 0.15s 0.08s;
    }
    #${AF_ID}-badge:hover .af-tab-lbl { opacity: 1; }
    #${AF_ID}-badge .af-tab-x {
      position: absolute; top: 6px; right: 6px; font-size: 10px; line-height: 1;
      color: rgba(255,255,255,0.55); opacity: 0; transition: opacity 0.15s; cursor: pointer;
    }
    #${AF_ID}-badge:hover .af-tab-x { opacity: 1; }
    #${AF_ID}-badge .af-tab-x:hover { color: #fff; }

    #${AF_ID}-panel {
      position: fixed; top: 50%; right: 16px; transform: translateY(-50%);
      z-index: 2147483647; width: 380px; max-height: 82vh;
      display: flex; flex-direction: column;
      background: #1a1a2e; border: 1px solid rgba(99,102,241,0.3);
      border-radius: 16px; box-shadow: 0 12px 48px rgba(0,0,0,0.55);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px; color: #e2e2f0; overflow: hidden;
      animation: af-slide-in 0.2s ease;
    }
    @keyframes af-slide-in {
      from { opacity: 0; transform: translateY(-50%) translateX(20px); }
      to   { opacity: 1; transform: translateY(-50%) translateX(0); }
    }

    .af-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px 12px; flex-shrink: 0;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      background: rgba(99,102,241,0.08);
    }
    .af-title-text { font-size: 13px; font-weight: 700; color: #c7d2fe; }
    .af-subtitle   { font-size: 11px; color: #9ca3af; margin-top: 2px; }
    .af-x { cursor: pointer; opacity: 0.5; font-size: 18px; line-height: 1; color: #e2e2f0; transition: opacity 0.1s; }
    .af-x:hover { opacity: 1; }

    .af-field-list { flex: 1; overflow-y: auto; padding: 6px 0; }
    .af-field-list::-webkit-scrollbar { width: 4px; }
    .af-field-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }

    /* Detection rows */
    .af-detect-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 14px; gap: 8px;
    }
    .af-detect-row:hover { background: rgba(255,255,255,0.04); }
    .af-detect-label { font-size: 12px; color: #e2e2f0; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Badges */
    .af-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; letter-spacing: 0.3px; }
    .af-badge-kind    { background: rgba(99,102,241,0.25);  color: #c7d2fe; border: 1px solid rgba(99,102,241,0.4); }
    .af-badge-unknown { background: rgba(255,255,255,0.07);  color: #9ca3af; border: 1px solid rgba(255,255,255,0.12); }
    .af-badge-ai      { background: rgba(168,85,247,0.25);  color: #e9d5ff; border: 1px solid rgba(168,85,247,0.4); }
    .af-badge-rules   { background: rgba(16,185,129,0.2);   color: #6ee7b7; border: 1px solid rgba(16,185,129,0.35); }
    .af-badge-none    { background: rgba(255,255,255,0.05); color: #6b7280; }

    /* Review items */
    .af-review-item {
      padding: 12px 14px 12px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      transition: background 0.1s;
    }
    .af-review-item:last-child { border-bottom: none; }
    .af-review-item:hover { background: rgba(255,255,255,0.03); }
    .af-review-item.af-excluded { opacity: 0.28; }
    .af-review-item-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .af-review-checkbox {
      width: 16px; height: 16px; accent-color: #6366f1; cursor: pointer; flex-shrink: 0;
      appearance: auto; -webkit-appearance: auto;
    }
    .af-review-label {
      flex: 1; font-size: 12px; font-weight: 600; color: #f0f0ff;
      min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    /* Value inputs — high contrast, immune to host-page CSS bleed */
    .af-review-input, .af-review-textarea {
      display: block !important;
      width: 100% !important; box-sizing: border-box !important;
      background: #1e1e38 !important;
      border: 1px solid rgba(99,102,241,0.45) !important;
      border-radius: 8px !important;
      color: #f5f5ff !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      font-size: 13px !important;
      line-height: 1.55 !important;
      padding: 8px 11px !important;
      outline: none !important;
      margin: 0 !important;
      transition: border-color 0.15s, box-shadow 0.15s !important;
    }
    .af-review-input:focus, .af-review-textarea:focus {
      border-color: #818cf8 !important;
      box-shadow: 0 0 0 3px rgba(99,102,241,0.18) !important;
    }
    .af-review-textarea { resize: vertical !important; min-height: 72px !important; }
    .af-review-file-note {
      font-size: 12px; color: #a5b4fc; padding: 8px 11px;
      background: rgba(99,102,241,0.12); border-radius: 8px;
      border: 1px solid rgba(99,102,241,0.3);
      line-height: 1.5;
    }

    /* Footer */
    .af-footer {
      padding: 10px 14px 14px; flex-shrink: 0;
      border-top: 1px solid rgba(255,255,255,0.08);
      background: rgba(0,0,0,0.2);
      display: flex; flex-direction: column; gap: 8px;
    }
    .af-footer-row { display: flex; align-items: center; justify-content: space-between; }
    .af-count { font-size: 12px; color: #a5b4fc; font-weight: 500; }
    .af-legend { display: flex; gap: 12px; }
    .af-legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #9ca3af; }
    .af-legend-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

    .af-btn { padding: 9px 18px; border: none; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s, opacity 0.15s; width: 100%; }
    .af-btn-primary { background: #6366f1; color: #fff; }
    .af-btn-primary:hover:not(:disabled) { background: #4f46e5; }
    .af-btn-primary:disabled { opacity: 0.35; cursor: default; }
    .af-btn-secondary { background: rgba(255,255,255,0.09); color: #d1d5db; border: 1px solid rgba(255,255,255,0.12); }
    .af-btn-secondary:hover { background: rgba(255,255,255,0.14); color: #f0f0ff; }

    .af-loading {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 12px; padding: 36px 20px;
      color: #6b7280; font-size: 12px;
    }
    .af-spinner {
      width: 22px; height: 22px;
      border: 2px solid rgba(99,102,241,0.25); border-top-color: #6366f1;
      border-radius: 50%; animation: af-spin 0.75s linear infinite;
    }
    @keyframes af-spin { to { transform: rotate(360deg); } }

    .af-success {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 10px; padding: 36px 20px; text-align: center;
    }
    .af-success-icon  { font-size: 38px; }
    .af-success-title { font-size: 15px; font-weight: 700; color: #6ee7b7; }
    .af-success-body  { font-size: 12px; color: #6b7280; line-height: 1.6; }
    .af-success-stats { display: flex; gap: 20px; margin-top: 4px; }
    .af-stat { text-align: center; }
    .af-stat-num  { font-size: 22px; font-weight: 700; color: #a5b4fc; }
    .af-stat-label { font-size: 10px; color: #6b7280; margin-top: 2px; }

    .af-note { font-size: 11px; color: #4b5563; text-align: center; }

    .af-learn-prompt {
      margin: 0 14px 4px;
      background: rgba(99,102,241,0.08);
      border: 1px solid rgba(99,102,241,0.2);
      border-radius: 10px;
      padding: 10px 12px;
    }
    .af-learn-heading { font-size: 12px; font-weight: 600; color: #a5b4fc; margin-bottom: 6px; }
    .af-learn-row { display: flex; align-items: baseline; gap: 8px; padding: 2px 0; font-size: 11px; }
    .af-learn-lbl { color: #9ca3af; flex: 0 0 auto; max-width: 145px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .af-learn-val { color: #d1d5db; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    .af-learn-actions { display: flex; gap: 8px; margin-top: 10px; }
    .af-btn-sm { padding: 6px 14px !important; font-size: 11px !important; border-radius: 7px !important; }
  `;
  document.head.appendChild(style);
}

// ── Fill Engine (Phase 5) ─────────────────────────────────────────────────────

function fillText(el: HTMLInputElement | HTMLTextAreaElement, value: string): boolean {
  try {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    // Use native setter so React / Vue synthetic events fire correctly
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  } catch { return false; }
}

function fillSelect(el: HTMLSelectElement, value: string): boolean {
  const v = value.toLowerCase().trim();
  const opts = Array.from(el.options).filter((o) => !o.disabled && o.value !== "");
  const match =
    opts.find((o) => o.value.toLowerCase() === v) ??
    opts.find((o) => o.text.toLowerCase() === v) ??
    opts.find((o) => o.text.toLowerCase().includes(v)) ??
    opts.find((o) => v.includes(o.text.toLowerCase()) && o.text.length > 2);
  if (!match) return false;
  el.value = match.value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("input",  { bubbles: true }));
  return true;
}

function getRadioLabel(el: HTMLInputElement): string {
  if (el.id) {
    const lbl = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl) return lbl.innerText.trim().toLowerCase();
  }
  return (
    el.closest("label")?.innerText.trim().toLowerCase() ??
    el.parentElement?.innerText.trim().toLowerCase() ??
    ""
  );
}

function fillRadio(el: HTMLInputElement, value: string): boolean {
  const { name } = el;
  if (!name) return false;
  const group = Array.from(
    document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`),
  );
  const v = value.toLowerCase().trim();
  const match =
    group.find((r) => r.value.toLowerCase() === v) ??
    group.find((r) => getRadioLabel(r) === v) ??
    group.find((r) => r.value.toLowerCase().includes(v) || v.includes(r.value.toLowerCase())) ??
    group.find((r) => getRadioLabel(r).includes(v) || v.includes(getRadioLabel(r)));
  if (!match) return false;
  match.checked = true;
  match.dispatchEvent(new Event("change", { bubbles: true }));
  match.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  return true;
}

function fillCheckbox(el: HTMLInputElement, value: string): boolean {
  const shouldCheck = /^(yes|true|1)$/i.test(value.trim());
  if (el.checked !== shouldCheck) {
    el.checked = shouldCheck;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
  return true;
}

function flashFilled(el: HTMLElement) {
  // Save and restore existing outline to avoid permanently clobbering styles
  const prevOutline = el.style.outline;
  const prevOffset  = el.style.outlineOffset;
  const prevTransition = el.style.transition;
  el.style.setProperty("outline",         "2px solid #6366f1", "important");
  el.style.setProperty("outline-offset",  "2px",               "important");
  el.style.setProperty("transition",      "outline-color 0.5s ease", "important");
  setTimeout(() => {
    el.style.setProperty("outline-color", "#6ee7b7", "important");
    setTimeout(() => {
      el.style.outline       = prevOutline;
      el.style.outlineOffset = prevOffset;
      el.style.transition    = prevTransition;
    }, 1400);
  }, 120);
}

interface ReviewItem {
  uid: string;
  kind: string;
  label: string;
  value: string;
  source: string;
  selector: string;
}

interface LearnedItem { label: string; value: string; }

async function fillResumeFile(el: HTMLInputElement, resumeId: string): Promise<boolean> {
  try {
    const result = await new Promise<{ pdf_bytes?: string | null } | null>((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_RESUME_PDF", payload: { resumeId } }, resolve);
    });
    if (!result?.pdf_bytes) return false;

    const binary = atob(result.pdf_bytes);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const file = new File([bytes], "resume.pdf", { type: "application/pdf" });
    const dt = new DataTransfer();
    dt.items.add(file);
    el.files = dt.files;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    return true;
  } catch { return false; }
}

async function fillFields(
  confirmed: ReviewItem[],
  resumeId: string | null,
): Promise<{ filled: number; skipped: number }> {
  let filled = 0;
  let skipped = 0;

  for (const item of confirmed) {
    const el = document.querySelector<HTMLElement>(item.selector);
    if (!el) { skipped++; continue; }

    let ok = false;

    if (el instanceof HTMLSelectElement) {
      ok = fillSelect(el, item.value);
    } else if (el instanceof HTMLInputElement) {
      if      (el.type === "radio")    ok = fillRadio(el, item.value);
      else if (el.type === "checkbox") ok = fillCheckbox(el, item.value);
      else if (el.type === "file") {
        if (item.kind === "resume_file" && resumeId) {
          ok = await fillResumeFile(el, resumeId);
        } else { skipped++; continue; }
      }
      else ok = fillText(el, item.value);
    } else if (el instanceof HTMLTextAreaElement) {
      ok = fillText(el, item.value);
    }

    if (ok) { flashFilled(el); filled++; }
    else skipped++;

    // Brief pause between fields — lets React/Vue reconcile state before next fill
    await new Promise<void>((r) => setTimeout(r, 80));
  }

  return { filled, skipped };
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function renderBadge(count: number): HTMLElement {
  const badge = document.createElement("div");
  badge.id = `${AF_ID}-badge`;
  badge.innerHTML = `
    <div class="af-tab-icon">
      <span>⚡</span>
      <span class="af-tab-cnt">${count}</span>
    </div>
    <span class="af-tab-lbl">Autofill form</span>
    <span class="af-tab-x">✕</span>
  `;
  return badge;
}

// ── Panel: Detection ──────────────────────────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
  full_name: "Full Name", first_name: "First Name", last_name: "Last Name",
  email: "Email", phone: "Phone",
  location: "Location", city: "City", state: "State", country: "Country", zip: "ZIP",
  linkedin: "LinkedIn", github: "GitHub", website: "Website",
  headline: "Headline", summary: "Summary / Cover Letter",
  work_auth: "Work Authorization", requires_sponsorship: "Sponsorship",
  salary: "Salary", years_experience: "Years of Experience", notice_period: "Notice Period",
  remote_preference: "Remote Preference", willing_to_relocate: "Willing to Relocate",
  gender: "Gender", ethnicity: "Ethnicity", disability: "Disability Status", veteran: "Veteran Status",
  resume_file: "Resume Upload", unknown: "Unknown",
};

function renderDetectionPanel(
  fields: DetectedField[],
  loggedIn: boolean,
  onMatch: () => void,
  onClose: () => void,
): HTMLElement {
  const panel = document.createElement("div");
  panel.id = `${AF_ID}-panel`;
  const known = fields.filter((f) => f.kind !== "unknown" && f.confidence >= 0.6);
  const unknownWithLabel = fields.filter(
    (f) => f.kind === "unknown" && f.label.trim() !== "" && f.label !== "(no label)",
  );
  const actionableCount = known.length + unknownWithLabel.length;

  const rows = [...fields]
    .sort((a, b) => (a.kind === "unknown" ? 1 : 0) - (b.kind === "unknown" ? 1 : 0))
    .map((f) => {
      const isKnown = f.kind !== "unknown" && f.confidence >= 0.6;
      const isAiFill = f.kind === "unknown" && f.label.trim() !== "" && f.label !== "(no label)";
      return `<div class="af-detect-row">
        <span class="af-detect-label" title="${f.label}">${f.label}</span>
        <span class="af-badge ${isKnown ? "af-badge-kind" : isAiFill ? "af-badge-ai" : "af-badge-unknown"}">
          ${isKnown ? (KIND_LABELS[f.kind] ?? f.kind) : isAiFill ? "AI" : "Unknown"}
        </span>
      </div>`;
    }).join("");

  panel.innerHTML = `
    <div class="af-header">
      <div>
        <div class="af-title-text">⚡ ApplyFlow</div>
        <div class="af-subtitle">${known.length} classified · ${unknownWithLabel.length} AI-fill · ${fields.length} total</div>
      </div>
      <span class="af-x">✕</span>
    </div>
    <div class="af-field-list">${rows}</div>
    <div class="af-footer">
      ${loggedIn
        ? `<button class="af-btn af-btn-primary" id="${AF_ID}-match-btn"
            ${actionableCount === 0 ? "disabled" : ""}>
            ${actionableCount === 0 ? "No fields matched" : `Match & Review ${actionableCount} field${actionableCount !== 1 ? "s" : ""} →`}
           </button>`
        : `<button class="af-btn af-btn-primary" id="${AF_ID}-signin-btn">
            Sign in to Autofill →
           </button>`
      }
    </div>
  `;

  panel.querySelector(".af-x")?.addEventListener("click", onClose);
  panel.querySelector(`#${AF_ID}-match-btn`)?.addEventListener("click", onMatch);
  panel.querySelector(`#${AF_ID}-signin-btn`)?.addEventListener("click", () => {
    onClose();
    showSignInPanel(() => void openPanel(fields));
  });
  return panel;
}

// ── Panel: Loading ────────────────────────────────────────────────────────────

function renderLoadingPanel(subtitle: string, onClose: () => void): HTMLElement {
  const panel = document.createElement("div");
  panel.id = `${AF_ID}-panel`;
  panel.innerHTML = `
    <div class="af-header">
      <div>
        <div class="af-title-text">⚡ ApplyFlow</div>
        <div class="af-subtitle">${subtitle}</div>
      </div>
      <span class="af-x">✕</span>
    </div>
    <div class="af-loading">
      <div class="af-spinner"></div>
      <span>${subtitle}</span>
    </div>
  `;
  panel.querySelector(".af-x")?.addEventListener("click", onClose);
  return panel;
}

// ── Panel: Review Sidebar ─────────────────────────────────────────────────────

function renderReviewSidebar(
  fields: DetectedField[],
  matches: FieldMatch[],
  resumeId: string | null,
  resumeName: string | null,
  onFill: (confirmed: ReviewItem[], resumeId: string | null) => Promise<void>,
  onClose: () => void,
): HTMLElement {
  const panel = document.createElement("div");
  panel.id = `${AF_ID}-panel`;

  const matchMap = new Map(matches.map((m) => [m.uid, m]));
  const hostname = (() => { try { return new URL(window.location.href).hostname; } catch { return ""; } })();

  const items: ReviewItem[] = fields
    .map((f) => {
      const m = matchMap.get(f.uid);
      return { uid: f.uid, kind: f.kind, label: f.label, value: m?.value ?? "", source: m?.source ?? "none", selector: f.selector };
    })
    // Keep unknown fields that have a label so the user can fill them manually even
    // when AI returned no suggestion (or API key is absent).
    .filter((item) => item.kind !== "unknown" || item.value || (item.label.trim() !== "" && item.label !== "(no label)"));

  const rows = items.map((item) => {
    const isLong = item.value.length > 80 || item.kind === "summary";
    const isFile = item.kind === "resume_file";
    const sourceBadge =
      item.source === "ai"    ? `<span class="af-badge af-badge-ai">AI</span>` :
      item.source === "rules" ? `<span class="af-badge af-badge-rules">Profile</span>` :
                                `<span class="af-badge af-badge-none">Manual</span>`;
    const hasResumeToAttach = isFile && !!resumeId;
    const inputEl = isFile
      ? hasResumeToAttach
        ? `<div class="af-review-file-note">📎 ${resumeName ?? "Tailored resume"} — will be attached automatically</div>`
        : `<div class="af-review-file-note" style="color:#6b7280">📁 No tailored PDF saved — upload manually</div>`
      : isLong
      ? `<textarea class="af-review-textarea" data-uid="${item.uid}">${item.value}</textarea>`
      : `<input class="af-review-input" data-uid="${item.uid}" type="text" value="${item.value.replace(/"/g, "&quot;")}">`;

    // File: enabled only when a PDF is ready to attach.
    // All other fields: always enabled so the user can type a value and check the box.
    // Pre-checked only when a value already exists (from profile or AI).
    const isEnabled = isFile ? hasResumeToAttach : true;
    const isChecked = isFile ? hasResumeToAttach : !!item.value;
    return `<div class="af-review-item" data-uid="${item.uid}" id="${AF_ID}-item-${item.uid}">
      <div class="af-review-item-header">
        <input type="checkbox" class="af-review-checkbox" data-uid="${item.uid}"
          ${isChecked ? "checked" : ""} ${!isEnabled ? "disabled" : ""}>
        <span class="af-review-label" title="${item.label}">${item.label}</span>
        ${sourceBadge}
      </div>
      ${inputEl}
    </div>`;
  }).join("");

  const withValue = items.filter((i) => i.value || (i.kind === "resume_file" && !!resumeId)).length;

  panel.innerHTML = `
    <div class="af-header">
      <div>
        <div class="af-title-text">⚡ ApplyFlow — Review & Fill</div>
        <div class="af-subtitle">${hostname}</div>
      </div>
      <span class="af-x">✕</span>
    </div>
    <div class="af-field-list">${rows}</div>
    <div class="af-footer">
      <div class="af-footer-row">
        <span class="af-count" id="${AF_ID}-count">${withValue} of ${items.length} fields ready</span>
        <div class="af-legend">
          <div class="af-legend-item"><div class="af-legend-dot" style="background:#6ee7b7"></div>Profile</div>
          <div class="af-legend-item"><div class="af-legend-dot" style="background:#c084fc"></div>AI</div>
        </div>
      </div>
      <button class="af-btn af-btn-primary" id="${AF_ID}-fill-btn" ${withValue === 0 ? "disabled" : ""}>
        Fill ${withValue} field${withValue !== 1 ? "s" : ""} →
      </button>
    </div>
  `;

  panel.querySelector(".af-x")?.addEventListener("click", onClose);

  panel.addEventListener("change", (e) => {
    const cb = e.target as HTMLInputElement;
    if (!cb.classList.contains("af-review-checkbox")) return;
    const uid = cb.dataset["uid"];
    panel.querySelector(`#${AF_ID}-item-${uid}`)?.classList.toggle("af-excluded", !cb.checked);
    updateFillBtn();
  });

  // Auto-check the checkbox when the user types a value into an empty field,
  // and auto-uncheck when they clear it.
  panel.addEventListener("input", (e) => {
    const input = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!input.classList.contains("af-review-input") && !input.classList.contains("af-review-textarea")) return;
    const uid = input.dataset["uid"];
    if (!uid) return;
    const cb = panel.querySelector<HTMLInputElement>(`.af-review-checkbox[data-uid="${uid}"]`);
    if (cb && !cb.disabled) {
      cb.checked = input.value.trim() !== "";
      panel.querySelector(`#${AF_ID}-item-${uid}`)?.classList.toggle("af-excluded", !cb.checked);
      updateFillBtn();
    }
  });

  function getChecked(): ReviewItem[] {
    const checked = new Set(
      Array.from(panel.querySelectorAll<HTMLInputElement>(".af-review-checkbox:checked"))
        .map((cb) => cb.dataset["uid"]),
    );
    return items
      .filter((item) => checked.has(item.uid))
      .map((item) => {
        const input = panel.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          `[data-uid="${item.uid}"].af-review-input, [data-uid="${item.uid}"].af-review-textarea`,
        );
        return { ...item, value: input?.value ?? item.value };
      })
      .filter((item) => item.value.trim() !== "" || item.kind === "resume_file");
  }

  function updateFillBtn() {
    const count = getChecked().length;
    const btn = panel.querySelector<HTMLButtonElement>(`#${AF_ID}-fill-btn`);
    const counter = panel.querySelector(`#${AF_ID}-count`);
    if (btn) {
      btn.disabled = count === 0;
      btn.textContent = count === 0 ? "No fields selected" : `Fill ${count} field${count !== 1 ? "s" : ""} →`;
    }
    if (counter) counter.textContent = `${count} of ${items.length} fields ready`;
  }

  panel.querySelector(`#${AF_ID}-fill-btn`)?.addEventListener("click", async () => {
    const btn = panel.querySelector<HTMLButtonElement>(`#${AF_ID}-fill-btn`);
    if (btn) { btn.disabled = true; btn.textContent = "Filling…"; }
    await onFill(getChecked(), resumeId);
  });

  return panel;
}

// ── Panel: Success ────────────────────────────────────────────────────────────

function renderSuccessPanel(
  filled: number,
  skipped: number,
  learnedItems: LearnedItem[],
  onSave: (items: LearnedItem[]) => void,
  onClose: () => void,
): HTMLElement {
  const panel = document.createElement("div");
  panel.id = `${AF_ID}-panel`;

  const visible = learnedItems.slice(0, 5);
  const learnPrompt = visible.length > 0 ? `
    <div class="af-learn-prompt">
      <div class="af-learn-heading">💡 Remember ${visible.length} answer${visible.length !== 1 ? "s" : ""} for next time?</div>
      <div>
        ${visible.map((i) => `
          <div class="af-learn-row">
            <span class="af-learn-lbl" title="${i.label}">${i.label}</span>
            <span class="af-learn-val" title="${i.value}">${i.value}</span>
          </div>`).join("")}
      </div>
      <div class="af-learn-actions">
        <button class="af-btn af-btn-primary af-btn-sm" id="${AF_ID}-save-learned-btn">Save to Profile</button>
        <button class="af-btn af-btn-secondary af-btn-sm" id="${AF_ID}-done-btn">Skip</button>
      </div>
    </div>
  ` : `
    <div class="af-footer">
      <button class="af-btn af-btn-secondary" id="${AF_ID}-done-btn">Done</button>
    </div>
  `;

  panel.innerHTML = `
    <div class="af-header">
      <div><div class="af-title-text">⚡ ApplyFlow</div></div>
      <span class="af-x">✕</span>
    </div>
    <div class="af-success">
      <div class="af-success-icon">${filled > 0 ? "✅" : "⚠️"}</div>
      <div class="af-success-title">
        ${filled > 0 ? `${filled} field${filled !== 1 ? "s" : ""} filled!` : "Nothing to fill"}
      </div>
      <div class="af-success-stats">
        <div class="af-stat">
          <div class="af-stat-num" style="color:#6ee7b7">${filled}</div>
          <div class="af-stat-label">Filled</div>
        </div>
        ${skipped > 0 ? `<div class="af-stat">
          <div class="af-stat-num" style="color:#6b7280">${skipped}</div>
          <div class="af-stat-label">Skipped</div>
        </div>` : ""}
      </div>
      ${skipped > 0 ? `<div class="af-success-body">Some fields couldn't be filled automatically.<br>Please complete them manually.</div>` : ""}
    </div>
    ${learnPrompt}
  `;

  panel.querySelector(".af-x")?.addEventListener("click", onClose);
  panel.querySelector(`#${AF_ID}-done-btn`)?.addEventListener("click", onClose);
  panel.querySelector(`#${AF_ID}-save-learned-btn`)?.addEventListener("click", () => {
    onSave(visible);
  });
  return panel;
}

// ── Orchestration ─────────────────────────────────────────────────────────────

function closeAll() {
  document.getElementById(`${AF_ID}-panel`)?.remove();
  document.getElementById(`${AF_ID}-badge`)?.remove();
}

function closePanel() {
  document.getElementById(`${AF_ID}-panel`)?.remove();
}

// Called after a successful fill — distinct from closeAll (which is used for X-dismiss).
// Sets waitingForNextStep so the badge won't re-appear on the same step's fields but
// WILL re-appear as soon as the form moves to a step with a different field set.
function finishFill() {
  lastFilledKey = currentFieldsKey;
  waitingForNextStep = true;
  closeAll();
}

function swapPanel(next: HTMLElement) {
  document.getElementById(`${AF_ID}-panel`)?.remove();
  document.body.appendChild(next);
}

async function openPanel(fields: DetectedField[]) {
  const session = await new Promise<{ token?: string } | null>((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_SESSION" }, resolve);
  });
  const loggedIn = !!session?.token;

  swapPanel(
    renderDetectionPanel(
      fields,
      loggedIn,
      async () => {
        // Phase 3: match fields
        swapPanel(renderLoadingPanel("Matching your profile…", closePanel));

        const known = fields.filter((f) => f.kind !== "unknown" && f.confidence >= 0.6);
        const unknownForAI = fields.filter(
          (f) => f.kind === "unknown" && f.label.trim() !== "" && f.label !== "(no label)",
        );
        const allActionable = [...known, ...unknownForAI];

        const response = await new Promise<{ matches?: FieldMatch[]; error?: string } | null>(
          (resolve) => {
            chrome.runtime.sendMessage(
              {
                type: "GET_MATCHES",
                payload: {
                  fields: allActionable.map((f) => ({
                    uid: f.uid, kind: f.kind, confidence: f.confidence,
                    input_type: f.inputType, label: f.label, selector: f.selector,
                  })),
                  url: window.location.href,
                },
              },
              resolve,
            );
          },
        );

        const matches: FieldMatch[] = response?.matches ?? [];
        const resumeId: string | null = (response as { resume_id?: string | null })?.resume_id ?? null;
        const resumeName: string | null = (response as { resume_name?: string | null })?.resume_name ?? null;

        // Phase 4: review sidebar
        swapPanel(
          renderReviewSidebar(
            allActionable,
            matches,
            resumeId,
            resumeName,
            async (confirmed, rId) => {
              // Store for record keeping
              chrome.storage.local.set({
                af_last_fill: { items: confirmed, url: window.location.href, timestamp: Date.now() },
              });

              // Phase 5: actually fill
              swapPanel(renderLoadingPanel("Filling fields…", closePanel));
              const { filled, skipped } = await fillFields(confirmed, rId);

              // Offer to save any field the user had to type manually (source !== "rules",
              // not a file, has a real label) — covers unknown AND known-kind fields
              // that aren't yet in the profile (e.g. website, salary).
              const learnedItems: LearnedItem[] = confirmed
                .filter((i) =>
                  i.source !== "rules" &&
                  i.kind !== "resume_file" &&
                  i.value.trim() !== "" &&
                  i.label.trim() !== "" &&
                  i.label !== "(no label)",
                )
                .map((i) => ({ label: i.label, value: i.value.trim() }));

              swapPanel(renderSuccessPanel(
                filled,
                skipped,
                learnedItems,
                (items) => {
                  chrome.runtime.sendMessage({
                    type: "SAVE_LEARNED_FIELDS",
                    payload: { fields: Object.fromEntries(items.map((i) => [i.label, i.value])) },
                  });
                  finishFill();
                },
                finishFill,
              ));
            },
            closePanel,
          ),
        );
      },
      closePanel,
    ),
  );
}

// ── LinkedIn guard ────────────────────────────────────────────────────────────
// LinkedIn Easy Apply is a modal on the same jobs page — the URL never changes
// to include "easy-apply". Only show the autofill badge when the modal is open.

const IS_LINKEDIN = window.location.hostname.includes("linkedin.com");

function linkedInModalOpen(): boolean {
  return !!(
    document.querySelector(".jobs-easy-apply-modal") ??
    document.querySelector("[aria-label*='Easy Apply']") ??
    document.querySelector(".jobs-easy-apply-content")
  );
}

function linkedInModalRoot(): ParentNode {
  return (
    document.querySelector<HTMLElement>(".jobs-easy-apply-modal") ??
    document.querySelector<HTMLElement>(".jobs-easy-apply-content") ??
    document
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

let currentKnownCount = 0;
let currentFieldsKey = "";    // selector fingerprint — changes when a new step loads
let waitingForNextStep = false; // true after a fill; badge held back until fields change
let lastFilledKey = "";         // the fingerprint of the step we just filled
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const dismissedKeys = new Set<string>(); // field-set keys the user explicitly closed

function getFieldsKey(fields: DetectedField[]): string {
  return fields.map((f) => f.selector).sort().join("|");
}

function run() {
  // On LinkedIn, only activate when the Easy Apply modal is open
  if (IS_LINKEDIN && !linkedInModalOpen()) {
    // If modal just closed, remove the badge
    if (currentKnownCount > 0) {
      currentKnownCount = 0;
      currentFieldsKey = "";
      waitingForNextStep = false;
      closeAll();
    }
    return;
  }

  // On LinkedIn scope scanning to the modal so background page fields don't leak in
  const scanRoot = IS_LINKEDIN ? linkedInModalRoot() : document;
  const fields = scanFields(scanRoot);
  const known = fields.filter((f) => f.kind !== "unknown" && f.confidence >= 0.6);
  const unknownActionable = fields.filter(
    (f) => f.kind === "unknown" && f.label.trim() !== "" && f.label !== "(no label)",
  );
  const actionableCount = known.length + unknownActionable.length;
  if (actionableCount === 0) return;

  const fieldsKey = getFieldsKey([...known, ...unknownActionable]);
  const panelOpen = !!document.getElementById(`${AF_ID}-panel`);

  // User explicitly dismissed this field-set — don't re-show on the same step
  if (dismissedKeys.has(fieldsKey)) return;

  if (waitingForNextStep) {
    // After a fill, hold back the badge until the form actually moves to a new step
    if (fieldsKey === lastFilledKey) return;
    waitingForNextStep = false; // new step detected — fall through to show badge
  } else if (fieldsKey === currentFieldsKey && !panelOpen) {
    return; // nothing changed, panel not open
  }

  currentFieldsKey = fieldsKey;
  currentKnownCount = actionableCount;

  injectStyles();

  document.getElementById(`${AF_ID}-badge`)?.remove();
  const badge = renderBadge(actionableCount);
  document.body.appendChild(badge);

  badge.querySelector(".af-tab-x")?.addEventListener("click", (e) => {
    e.stopPropagation();
    dismissedKeys.add(currentFieldsKey);
    closeAll();
  });
  badge.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("af-tab-x")) return;
    if (document.getElementById(`${AF_ID}-panel`)) { closePanel(); return; }
    void openPanel(fields);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", run);
} else {
  run();
}

const observer = new MutationObserver(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(run, 600);
});
// childList catches React/Vue step transitions (DOM add/remove).
// attributes catches CSS-based step transitions (aria-hidden, hidden, data-* toggles).
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["aria-hidden", "hidden", "data-step", "data-active", "aria-expanded", "aria-selected"],
});
