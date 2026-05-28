/**
 * Lightweight application assistant UI.
 *
 * A compact floating indicator that appears on ATS form pages when an
 * ApplySession is active. It is NOT a popup and does NOT require user
 * interaction to appear or disappear.
 *
 * Design constraints:
 * - Non-blocking: never intercepts any events the portal handles
 * - Ephemeral: auto-destroys when session is cleared or job changes
 * - Minimal footprint: single DOM element, scoped styles, no shadow DOM needed
 * - Survives portal re-renders: MutationObserver re-injects if removed
 */

import type { ApplySession } from "../runtime/application-session";

const ASSISTANT_ID = "af-application-assistant";
const STYLE_ID = "af-application-assistant-styles";

export type AssistantStatus =
  | "preparing"
  | "resume_ready"
  | "fields_detected"
  | "autofill_ready"
  | "filling"
  | "submitted"
  | "error";

// Module state — one assistant per content-script instance
let _minimized = false;
let _guardObserver: MutationObserver | null = null;
let _currentSession: ApplySession | null = null;

// ── Status helpers ────────────────────────────────────────────────────────────

function statusText(status: AssistantStatus, fieldCount?: number): string {
  switch (status) {
    case "preparing":       return "Preparing application…";
    case "resume_ready":    return "Resume attached ✓";
    case "fields_detected": return fieldCount ? `${fieldCount} fields detected` : "Fields detected";
    case "autofill_ready":  return "Autofill ready";
    case "filling":         return "Filling fields…";
    case "submitted":       return "Application submitted ✓";
    case "error":           return "Ready — manual mode";
  }
}

function statusColor(status: AssistantStatus): string {
  if (status === "submitted") return "#10b981";
  if (status === "error")     return "#f59e0b";
  return "#6366f1";
}

// ── Styles (injected once per page) ──────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ASSISTANT_ID} {
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 2147483646;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      pointer-events: auto;
    }
    #${ASSISTANT_ID} .afa-card {
      background: rgba(17, 24, 39, 0.96);
      border: 1px solid rgba(99, 102, 241, 0.45);
      border-radius: 12px;
      padding: 10px 14px;
      min-width: 200px;
      max-width: 260px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.45);
      transition: padding 0.2s ease, min-width 0.2s ease;
    }
    #${ASSISTANT_ID} .afa-card.afa-minimized {
      min-width: 0;
      padding: 8px 12px;
    }
    #${ASSISTANT_ID} .afa-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }
    #${ASSISTANT_ID} .afa-card.afa-minimized .afa-header {
      margin-bottom: 0;
    }
    #${ASSISTANT_ID} .afa-logo {
      color: #6366f1;
      font-weight: 700;
      font-size: 13px;
    }
    #${ASSISTANT_ID} .afa-title {
      color: #e5e7eb;
      font-weight: 600;
      font-size: 12px;
      flex: 1;
    }
    #${ASSISTANT_ID} .afa-min-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: #9ca3af;
      font-size: 14px;
      padding: 0 2px;
      line-height: 1;
      transition: color 0.1s;
    }
    #${ASSISTANT_ID} .afa-min-btn:hover { color: #e5e7eb; }
    #${ASSISTANT_ID} .afa-body { display: block; }
    #${ASSISTANT_ID} .afa-card.afa-minimized .afa-body { display: none; }
    #${ASSISTANT_ID} .afa-portal {
      font-size: 11px;
      color: #9ca3af;
      margin-bottom: 5px;
      text-transform: capitalize;
    }
    #${ASSISTANT_ID} .afa-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      transition: color 0.2s;
    }
    #${ASSISTANT_ID} .afa-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
      transition: background 0.2s;
    }
  `;
  document.head?.appendChild(style);
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(session: ApplySession, status: AssistantStatus, fieldCount?: number): string {
  const color = statusColor(status);
  const portal = session.currentPortal.replace(/_/g, " ");
  const text = statusText(status, fieldCount);

  return `
    <div class="afa-card${_minimized ? " afa-minimized" : ""}" id="afa-card">
      <div class="afa-header">
        <span class="afa-logo">⚡</span>
        <span class="afa-title">ApplyFlow Active</span>
        <button class="afa-min-btn" id="afa-min" title="${_minimized ? "Expand" : "Minimize"}">
          ${_minimized ? "+" : "−"}
        </button>
      </div>
      <div class="afa-body">
        <div class="afa-portal">${portal} detected</div>
        <div class="afa-status" style="color:${color}">
          <div class="afa-dot" style="background:${color}"></div>
          <span id="afa-status-text">${text}</span>
        </div>
      </div>
    </div>
  `;
}

function attachListeners(container: HTMLElement): void {
  container.querySelector("#afa-min")?.addEventListener("click", () => {
    _minimized = !_minimized;
    const card = container.querySelector("#afa-card");
    const btn  = container.querySelector<HTMLButtonElement>("#afa-min");
    card?.classList.toggle("afa-minimized", _minimized);
    if (btn) btn.textContent = _minimized ? "+" : "−";
    if (btn) btn.title = _minimized ? "Expand" : "Minimize";
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export function injectAssistant(session: ApplySession, status: AssistantStatus = "preparing", fieldCount?: number): void {
  _currentSession = session;
  document.getElementById(ASSISTANT_ID)?.remove();
  _guardObserver?.disconnect();

  injectStyles();

  const container = document.createElement("div");
  container.id = ASSISTANT_ID;
  container.innerHTML = buildHtml(session, status, fieldCount);
  document.body?.appendChild(container);
  attachListeners(container);

  // Guard: re-inject if the portal removes our element
  _guardObserver = new MutationObserver(() => {
    if (!_currentSession) { _guardObserver?.disconnect(); return; }
    if (!document.getElementById(ASSISTANT_ID)) {
      _guardObserver?.disconnect();
      _guardObserver = null;
      injectAssistant(_currentSession, status, fieldCount);
    }
  });
  _guardObserver.observe(document.body, { childList: true });
}

export function updateAssistantStatus(status: AssistantStatus, fieldCount?: number): void {
  const textEl = document.getElementById("afa-status-text");
  const dotEl  = document.querySelector<HTMLElement>(`#${ASSISTANT_ID} .afa-dot`);
  const statusEl = document.querySelector<HTMLElement>(`#${ASSISTANT_ID} .afa-status`);
  if (!textEl) return;

  const color = statusColor(status);
  textEl.textContent = statusText(status, fieldCount);
  if (dotEl)    dotEl.style.background = color;
  if (statusEl) statusEl.style.color   = color;
}

export function destroyAssistant(): void {
  _guardObserver?.disconnect();
  _guardObserver = null;
  _currentSession = null;
  _minimized = false;
  document.getElementById(ASSISTANT_ID)?.remove();
}

export function isAssistantActive(): boolean {
  return !!document.getElementById(ASSISTANT_ID);
}
