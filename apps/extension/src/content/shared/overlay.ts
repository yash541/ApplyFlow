import type { LinkedInJobData, ExtensionMessage } from "@applyflow/shared";
import { showToast } from "./toast";
// signin-panel is no longer used — login happens via the web app (SSO)
import type { JobFingerprint } from "../tracking/fingerprint";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AppRecord = {
  id: string;
  company: string;
  role: string;
  status: string;
  applied_at: string;
  has_resume: boolean;
  resume_id: string | null;
  ats_score: number | null;
  job_url: string | null;
} | null;

// ── Pipeline helpers ──────────────────────────────────────────────────────────

const PIPELINE = ["saved", "applied", "interview", "offer"] as const;

export const PIPELINE_LABELS: Record<string, string> = {
  saved: "Saved", applied: "Applied", screening: "Applied",
  interview: "Interview", technical: "Interview", offer: "Offer",
};

export const NEXT_STATUS: Record<string, string> = {
  saved: "applied", applied: "interview", screening: "interview",
  interview: "offer", technical: "offer",
};

function pipelineIndex(status: string): number {
  const map: Record<string, number> = {
    saved: 0, applied: 1, screening: 1, interview: 2, technical: 2, offer: 3,
  };
  return map[status] ?? 0;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function buildPipeline(status: string): string {
  const idx = pipelineIndex(status);
  return PIPELINE.map((s, i) => {
    const cls = i < idx ? "af-step af-step-done" : i === idx ? "af-step af-step-current" : "af-step";
    return `<div class="${cls}">${PIPELINE_LABELS[s] ?? s}</div>${i < PIPELINE.length - 1 ? '<div class="af-step-arrow">›</div>' : ""}`;
  }).join("");
}

function buildTrackedSection(app: NonNullable<AppRecord>): string {
  const nextStatus = NEXT_STATUS[app.status];
  const nextLabel = nextStatus ? PIPELINE_LABELS[nextStatus] ?? nextStatus : null;

  const resumeRow = app.has_resume
    ? `<div class="af-resume-ready">
        <span class="af-resume-icon">📄</span>
        <span class="af-resume-label">Resume ready${app.ats_score != null ? ` · ATS ${app.ats_score}` : ""}</span>
        <button class="af-btn-open-resume" id="af-open-resume">Open →</button>
      </div>`
    : `<button class="af-btn-tailor" id="af-tailor">✨ Tailor Resume</button>`;

  return `
    <div class="af-tracked-badge">
      <span class="af-tracked-dot"></span>
      Already tracking · <span class="af-tracked-date">${timeAgo(app.applied_at)}</span>
    </div>
    <div class="af-pipeline">${buildPipeline(app.status)}</div>
    ${nextLabel
      ? `<button class="af-btn-advance" id="af-advance">→ Move to ${nextLabel}</button>`
      : `<div class="af-pipeline-done">🎉 Offer stage reached!</div>`
    }
    ${resumeRow}
  `;
}

function openLogin() {
  // Route through background — content scripts on CSP-strict pages (LinkedIn)
  // can't call chrome.tabs.create directly.
  chrome.runtime.sendMessage({ type: "OPEN_LOGIN" });
}

function loginRequiredToast() {
  showToast("info", "Login required", "Sign in to ApplyFlow to continue.",
    { label: "Log in →", onClick: openLogin }, 8000);
}

// ── Main overlay injector ─────────────────────────────────────────────────────

export function injectOverlay(
  matchScore: number,
  jobData: LinkedInJobData,
  existing: AppRecord = null,
  fingerprint?: JobFingerprint,
  onAppSaved?: (appId: string) => void,
): void {
  document.getElementById("applyflow-overlay")?.remove();

  const tierLabel =
    matchScore >= 85 ? "🟢 Excellent" :
    matchScore >= 70 ? "🔵 Good" :
    matchScore >= 50 ? "🟡 Fair" : "🔴 Low";

  const actionsHtml = existing
    ? buildTrackedSection(existing)
    : `<button class="af-btn-primary" id="af-save">+ Track this job</button>`;

  const container = document.createElement("div");
  container.id = "applyflow-overlay";
  container.innerHTML = `
    <div class="af-panel af-open" id="af-panel">
      <div class="af-header">
        <span class="af-logo">⚡ ApplyFlow AI</span>
        <button class="af-close" id="af-close">✕</button>
      </div>
      <div class="af-score-section">
        <div class="af-score-ring">
          <span class="af-score-value">${matchScore}</span>
          <span class="af-score-label">match</span>
        </div>
        <div class="af-score-info">
          <p class="af-company">${jobData.company}</p>
          <p class="af-title">${jobData.title}</p>
          <p class="af-tier">${tierLabel} Match</p>
        </div>
      </div>
      <div class="af-actions" id="af-actions">
        ${actionsHtml}
      </div>
    </div>
    <button class="af-bubble" id="af-bubble">
      <span class="af-bubble-logo">⚡</span>
      <span class="af-bubble-score">${matchScore}</span>
    </button>
  `;

  document.body.appendChild(container);

  // ── Panel open/close ──────────────────────────────────────────────────────
  const panel = document.getElementById("af-panel") as HTMLElement;
  const bubble = document.getElementById("af-bubble") as HTMLButtonElement;
  let isOpen = true;

  function closePanel() {
    isOpen = false;
    panel.classList.remove("af-open");
    panel.classList.add("af-close-anim");
    setTimeout(() => { panel.style.display = "none"; panel.classList.remove("af-close-anim"); }, 200);
  }
  function openPanel() {
    isOpen = true;
    panel.style.display = "block";
    panel.classList.remove("af-close-anim");
    panel.classList.add("af-open");
  }

  bubble.addEventListener("click", () => { isOpen ? closePanel() : openPanel(); });
  document.getElementById("af-close")?.addEventListener("click", closePanel);

  // ── Action listeners (attached on every render/re-render) ─────────────────
  function attachActionListeners(app: AppRecord) {
    document.getElementById("af-tailor")?.addEventListener("click", () => {
      chrome.runtime.sendMessage(
        {
          type: "OPEN_TAILOR",
          payload: { jd: jobData.description, company: jobData.company, role: jobData.title, applicationId: app?.id },
        } as ExtensionMessage,
        (res: { ok: boolean } | null) => {
          if (chrome.runtime.lastError || !res?.ok) {
            loginRequiredToast();
          }
        },
      );
    });

    document.getElementById("af-open-resume")?.addEventListener("click", () => {
      if (!app?.resume_id) return;
      chrome.runtime.sendMessage(
        { type: "OPEN_RESUME", payload: { resumeId: app.resume_id, applicationId: app.id } } as ExtensionMessage,
        (res: { ok: boolean } | null) => {
          if (chrome.runtime.lastError || !res?.ok) {
            loginRequiredToast();
          }
        },
      );
    });
  }

  // ── Advance pipeline ──────────────────────────────────────────────────────
  if (existing) {
    let currentApp = { ...existing };

    function rerenderActions(app: NonNullable<AppRecord>) {
      const actions = document.getElementById("af-actions");
      if (!actions) return;
      actions.innerHTML = buildTrackedSection(app);
      attachAdvanceListener();
      attachActionListeners(app);
    }

    function attachAdvanceListener() {
      document.getElementById("af-advance")?.addEventListener("click", () => {
        const btn = document.getElementById("af-advance") as HTMLButtonElement | null;
        const nextStatus = NEXT_STATUS[currentApp.status];
        if (!btn || !nextStatus) return;
        btn.disabled = true;
        btn.textContent = "Updating…";

        chrome.runtime.sendMessage(
          { type: "UPDATE_APP_STATUS", payload: { id: currentApp.id, status: nextStatus } } as ExtensionMessage,
          (res: { success?: boolean; error?: string; data?: AppRecord } | null) => {
            if (chrome.runtime.lastError || !res?.success) {
              if (btn) { btn.disabled = false; btn.textContent = `→ Move to ${PIPELINE_LABELS[nextStatus] ?? nextStatus}`; }
              if (!res || res.error === "AUTH_REQUIRED") { loginRequiredToast(); } else {
                showToast("error", "Update failed", res.error ?? "Could not update status.");
              }
              return;
            }
            currentApp = { ...currentApp, status: nextStatus };
            rerenderActions(currentApp);
          },
        );
      });
    }

    attachAdvanceListener();
    attachActionListeners(existing);
  }

  // ── Save Job ──────────────────────────────────────────────────────────────
  document.getElementById("af-save")?.addEventListener("click", () => {
    const saveBtn = document.getElementById("af-save") as HTMLButtonElement | null;
    if (!saveBtn || saveBtn.disabled) return;
    saveBtn.disabled = true;
    saveBtn.textContent = "Tracking…";

    chrome.runtime.sendMessage(
      {
        type: "SYNC_APPLICATION",
        payload: {
          jobData,
          status: "saved",
          fingerprintHash: fingerprint?.hash,
          portal: fingerprint?.portal,
          canonicalUrl: fingerprint?.canonicalUrl,
          externalJobId: fingerprint?.externalJobId,
        },
      } as ExtensionMessage,
      (response: { success?: boolean; error?: string; data?: { id?: string } } | null) => {
        if (chrome.runtime.lastError || !response?.success) {
          if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "+ Track this job"; }
          if (!response || response.error === "AUTH_REQUIRED") { loginRequiredToast(); } else {
            showToast("error", "Tracking failed", response.error ?? "Could not save this job.");
          }
          return;
        }

        const newAppId = response.data?.id ?? "";
        // Build the app record from data we already have — no second round-trip needed.
        const app: NonNullable<AppRecord> = {
          id: newAppId,
          company: jobData.company,
          role: jobData.title,
          status: "saved",
          applied_at: new Date().toISOString(),
          has_resume: false,
          resume_id: null,
          ats_score: null,
          job_url: jobData.url,
        };
        // Notify portal-runner so it can start the submission detector
        if (newAppId) onAppSaved?.(newAppId);
        injectOverlay(matchScore, jobData, app, fingerprint, onAppSaved);
      },
    );
  });
}
