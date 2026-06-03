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

// ── Score animation ───────────────────────────────────────────────────────────

let _animTimer: ReturnType<typeof setInterval> | null = null;
let _animCurrent = 0;

function _clearAnim() {
  if (_animTimer) { clearInterval(_animTimer); _animTimer = null; }
}

function _scoreEl()  { return document.querySelector<HTMLElement>(".af-score-value");  }
function _bubbleEl() { return document.querySelector<HTMLElement>(".af-bubble-score"); }
function _tierEl()   { return document.querySelector<HTMLElement>(".af-tier"); }
function _arcEl()    { return document.querySelector<SVGCircleElement>(".af-score-arc"); }

const ARC_R = 38;
const ARC_C = 2 * Math.PI * ARC_R; // ≈ 238.76

function _scoreColor(score: number): string {
  if (score >= 85) return "#10b981"; // green  - Excellent
  if (score >= 70) return "#6366f1"; // indigo - Good
  if (score >= 50) return "#f59e0b"; // amber  - Fair
  return "#ef4444";                   // red    - Low
}

function _updateArc(score: number): void {
  const arc = _arcEl();
  if (!arc) return;
  const pct    = Math.max(0, Math.min(100, score)) / 100;
  arc.style.strokeDashoffset = String(ARC_C * (1 - pct));
  arc.style.stroke = _scoreColor(score);
}

function startScoreAnim() {
  _animCurrent = 0;
  _clearAnim();
  _animTimer = setInterval(() => {
    if (_animCurrent >= 55) { _clearAnim(); return; }
    _animCurrent += 1;
    const s = _scoreEl(); const b = _bubbleEl();
    if (s) s.textContent = String(_animCurrent);
    if (b) b.textContent = String(_animCurrent);
    _updateArc(_animCurrent);
  }, 30); // 1 per 30ms → 0→55 in ~1.65s
}

/** Called when the real score arrives — counts from the current animated value
 *  to the final score, then flashes green to signal completion. */
export function updateOverlayScore(finalScore: number, scoreBasis: string): void {
  _clearAnim();

  // Login required — stop animation, show key icon + prompt
  if (scoreBasis === "login_required") {
    const s = _scoreEl(); const b = _bubbleEl(); const t = _tierEl();
    if (s) { s.textContent = "🔑"; s.style.fontSize = "18px"; }
    if (b) b.textContent = "?";
    if (t) t.textContent = "Log in to see score";
    _updateArc(0); // empty arc
    return;
  }

  const isEst = scoreBasis === "title_only";
  let cur      = _animCurrent;
  const step   = finalScore >= cur ? 1 : -1;
  const dist   = Math.abs(finalScore - cur);

  // Target ~400ms for the sprint regardless of distance.
  // Minimum 5ms so it never looks frozen; maximum 30ms so it never drags.
  const interval = dist > 0 ? Math.min(30, Math.max(5, Math.floor(400 / dist))) : 5;

  _animTimer = setInterval(() => {
    if (cur === finalScore) {
      _clearAnim();
      // Flash green to confirm lock-in
      const s = _scoreEl();
      if (s) {
        s.style.transition = "color 0.25s";
        s.style.color = "#6ee7b7";
        setTimeout(() => { const el = _scoreEl(); if (el) el.style.color = ""; }, 700);
      }
      // Update tier label with real score
      const t = _tierEl();
      if (t) {
        const tier = finalScore >= 85 ? "🟢 Excellent" : finalScore >= 70 ? "🔵 Good" : finalScore >= 50 ? "🟡 Fair" : "🔴 Low";
        t.textContent = `${tier} Match${isEst ? " (est.)" : ""}`;
      }
      return;
    }
    cur += step;
    _animCurrent = cur;
    const display = isEst ? `~${cur}` : String(cur);
    const s = _scoreEl(); const b = _bubbleEl();
    if (s) s.textContent = display;
    if (b) b.textContent = display;
    _updateArc(cur);
  }, interval);
}

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

// ── Loading overlay (appears immediately, no job data yet) ───────────────────

export function injectLoadingOverlay(): void {
  document.getElementById("applyflow-overlay")?.remove();
  _clearAnim();
  _animCurrent = 0;

  const arcC = ARC_C.toFixed(2);
  const container = document.createElement("div");
  container.id = "applyflow-overlay";
  container.innerHTML = `
    <div class="af-panel af-open" id="af-panel">
      <div class="af-header">
        <span class="af-logo">⚡ ApplyFlow AI</span>
        <button class="af-close" id="af-close">✕</button>
      </div>
      <div class="af-score-section">
        <div class="af-score-ring" style="position:relative;width:90px;height:90px;flex-shrink:0;">
          <svg width="90" height="90" viewBox="0 0 90 90" style="position:absolute;top:0;left:0;">
            <circle cx="45" cy="45" r="${ARC_R}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="5.5"/>
            <circle cx="45" cy="45" r="${ARC_R}" fill="none"
              stroke="#ef4444" stroke-width="5.5" stroke-linecap="round"
              stroke-dasharray="${arcC}" stroke-dashoffset="${arcC}"
              class="af-score-arc" transform="rotate(-90 45 45)"
              style="transition:stroke-dashoffset 0.08s linear,stroke 0.35s ease;"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;">
            <span class="af-score-value" style="font-size:24px;font-weight:800;color:#fff;line-height:1;">0</span>
            <span class="af-score-label" style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:0.08em;text-transform:uppercase;">MATCH</span>
          </div>
        </div>
        <div class="af-score-info">
          <div class="af-shimmer" style="width:90px;height:10px;margin-bottom:8px;"></div>
          <div class="af-shimmer" style="width:150px;height:14px;margin-bottom:10px;"></div>
          <p class="af-tier" style="font-size:11px;color:rgba(255,255,255,0.35);">🔍 Scanning job...</p>
        </div>
      </div>
      <div class="af-actions" id="af-actions">
        <div class="af-shimmer" style="width:100%;height:38px;border-radius:10px;"></div>
      </div>
    </div>
    <button class="af-bubble" id="af-bubble">
      <span class="af-bubble-logo">⚡</span>
      <span class="af-bubble-score">0</span>
    </button>
  `;

  document.body.appendChild(container);

  // Wire close button and bubble toggle
  const panel  = document.getElementById("af-panel") as HTMLElement;
  const bubble = document.getElementById("af-bubble") as HTMLButtonElement;
  let isOpen = true;
  function closePanel() { panel.style.display = "none"; isOpen = false; }
  function openPanel()  { panel.style.display = "flex"; isOpen = true; }
  bubble.addEventListener("click", () => { isOpen ? closePanel() : openPanel(); });
  document.getElementById("af-close")?.addEventListener("click", closePanel);

  // Start the count-up animation immediately
  startScoreAnim();
}

/** Populate the loading overlay with real job data (called after scraping).
 *  Replaces shimmer skeletons with actual content, fading in smoothly. */
export function populateOverlayContent(
  jobData: LinkedInJobData,
  existing: AppRecord,
  fingerprint: JobFingerprint | undefined,
  onAppSaved: ((appId: string) => void) | undefined,
): void {
  const info = document.querySelector<HTMLElement>(".af-score-info");
  if (info) {
    info.innerHTML = `
      <p class="af-company af-content-fade-in">${jobData.company}</p>
      <p class="af-title  af-content-fade-in">${jobData.title}</p>
      <p class="af-tier   af-content-fade-in">🔴 Low Match…</p>`;
  }

  const actions = document.getElementById("af-actions");
  if (actions) {
    const actionsHtml = existing
      ? buildTrackedSection(existing)
      : `<button class="af-btn-primary" id="af-save">+ Track this job</button>`;
    actions.innerHTML = actionsHtml;
    actions.classList.add("af-content-fade-in");

    // Wire the save button if not already tracked
    if (!existing) {
      actions.querySelector("#af-save")?.addEventListener("click", () => {
        const saveBtn = document.getElementById("af-save") as HTMLButtonElement | null;
        if (!saveBtn || saveBtn.disabled) return;
        saveBtn.disabled = true; saveBtn.textContent = "Tracking…";
        chrome.runtime.sendMessage(
          { type: "SYNC_APPLICATION", payload: { jobData, status: "saved",
              fingerprintHash: fingerprint?.hash, portal: fingerprint?.portal,
              canonicalUrl: fingerprint?.canonicalUrl, externalJobId: fingerprint?.externalJobId } },
          (res: { success?: boolean; error?: string; data?: { id?: string } } | null) => {
            if (res?.success && res.data?.id) { onAppSaved?.(res.data.id); }
            else {
              if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "+ Track this job"; }
            }
          }
        );
      });
    }
    if (existing?.id) {
      // Attach pipeline advance + action listeners
      const dummyOverlayEl = document.getElementById("applyflow-overlay");
      if (dummyOverlayEl) {
        // Re-use the existing attachAdvanceListener via re-inject trick
        injectOverlay(0, jobData, existing, fingerprint, onAppSaved, "loading");
      }
    }
  }
}

// ── Button wiring helpers (reused by in-place update + full inject) ───────────

function _wireSaveButton(
  container: HTMLElement,
  jobData: LinkedInJobData,
  fingerprint: JobFingerprint | undefined,
  onAppSaved: ((id: string) => void) | undefined,
  matchScore: number = 0,
  scoreBasis: string = "full_jd",
): void {
  const saveBtn = container.querySelector<HTMLButtonElement>("#af-save");
  if (!saveBtn) return;
  saveBtn.addEventListener("click", () => {
    if (saveBtn.disabled) return;
    saveBtn.disabled = true; saveBtn.textContent = "Tracking…";
    chrome.runtime.sendMessage(
      { type: "SYNC_APPLICATION", payload: {
          jobData, status: "saved",
          fingerprintHash: fingerprint?.hash, portal: fingerprint?.portal,
          canonicalUrl: fingerprint?.canonicalUrl, externalJobId: fingerprint?.externalJobId,
        } } as ExtensionMessage,
      (res: { success?: boolean; data?: { id?: string }; error?: string } | null) => {
        if (chrome.runtime.lastError || !res?.success) {
          if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "+ Track this job"; }
          if (!res || res.error === "AUTH_REQUIRED") loginRequiredToast();
          else showToast("error", "Tracking failed", res?.error ?? "Could not save this job.");
        } else if (res.data?.id) {
          const appId = res.data.id;
          onAppSaved?.(appId);
          // Re-inject overlay with the tracked state so it shows pipeline + advance button
          const newApp: NonNullable<AppRecord> = {
            id: appId, company: jobData.company, role: jobData.title,
            status: "saved", applied_at: new Date().toISOString(),
            has_resume: false, resume_id: null, ats_score: null, job_url: jobData.url,
          };
          injectOverlay(matchScore, jobData, newApp, fingerprint, onAppSaved, scoreBasis);
        }
      }
    );
  });
}

function _wireAdvanceAndActionListeners(
  app: NonNullable<AppRecord>,
  jobData: LinkedInJobData,
  _fingerprint: JobFingerprint | undefined,
  _onAppSaved: ((id: string) => void) | undefined,
): void {
  let currentApp = { ...app };
  const NEXT: Record<string, string> = {
    saved: "applied", applied: "interview", screening: "interview",
    interview: "offer", technical: "offer",
  };
  const advBtn = document.getElementById("af-advance") as HTMLButtonElement | null;
  if (advBtn) {
    advBtn.addEventListener("click", () => {
      const next = NEXT[currentApp.status];
      if (!advBtn || !next) return;
      advBtn.disabled = true; advBtn.textContent = "Updating…";
      chrome.runtime.sendMessage(
        { type: "UPDATE_APP_STATUS", payload: { id: currentApp.id, status: next } } as ExtensionMessage,
        (res: { success?: boolean; error?: string } | null) => {
          if (!res?.success) {
            advBtn.disabled = false;
            advBtn.textContent = `→ Move to ${PIPELINE_LABELS[next] ?? next}`;
            if (!res || res.error === "AUTH_REQUIRED") loginRequiredToast();
          } else {
            currentApp = { ...currentApp, status: next };
          }
        }
      );
    });
  }
  document.getElementById("af-tailor")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_TAILOR",
      payload: { jd: jobData.description, company: jobData.company,
                 role: jobData.title, applicationId: app.id } } as ExtensionMessage);
  });
}

// ── Main overlay injector ─────────────────────────────────────────────────────

export function injectOverlay(
  matchScore: number,
  jobData: LinkedInJobData,
  existing: AppRecord = null,
  fingerprint?: JobFingerprint,
  onAppSaved?: (appId: string) => void,
  scoreBasis: string = "full_jd",
): void {
  // If a loading overlay is already on screen, update it in place — no flash/flicker.
  // Only the shimmer content (score-info + actions) is swapped; the container,
  // score ring SVG, and running animation are left untouched.
  const loadingOverlay = document.getElementById("applyflow-overlay");
  if (loadingOverlay && loadingOverlay.querySelector(".af-shimmer") && scoreBasis !== "loading") {
    const isLimited   = scoreBasis === "limit_exceeded";
    const isEstimated = scoreBasis === "title_only";
    const tierLabel =
      isLimited ? "Upgrade for scores" :
      matchScore >= 85 ? "🟢 Excellent" :
      matchScore >= 70 ? "🔵 Good" :
      matchScore >= 50 ? "🟡 Fair" : "🔴 Low";

    // Replace shimmer score-info with real company/title/tier
    const info = loadingOverlay.querySelector<HTMLElement>(".af-score-info");
    if (info) {
      info.innerHTML = `
        <p class="af-company af-content-fade-in">${jobData.company}</p>
        <p class="af-title  af-content-fade-in">${jobData.title}</p>
        <p class="af-tier   af-content-fade-in">${tierLabel} Match${isEstimated ? " (est.)" : ""}</p>`;
    }

    // Replace shimmer action button with real track/advance button
    const actions = loadingOverlay.querySelector<HTMLElement>("#af-actions");
    if (actions) {
      const actionsHtml = existing
        ? buildTrackedSection(existing)
        : `<button class="af-btn-primary af-content-fade-in" id="af-save">+ Track this job</button>`;
      actions.innerHTML = actionsHtml;
      // Wire the save button — pass score/basis so re-inject after save uses same values
      _wireSaveButton(actions, jobData, fingerprint, onAppSaved, matchScore, scoreBasis);
      if (existing) { _wireAdvanceAndActionListeners(existing, jobData, fingerprint, onAppSaved); }
    }
    return; // skip full re-inject — overlay stays in place
  }

  document.getElementById("applyflow-overlay")?.remove();

  _clearAnim();
  _animCurrent = matchScore;

  const isLoading   = scoreBasis === "loading";
  const isEstimated = scoreBasis === "title_only";
  const isLimited   = scoreBasis === "limit_exceeded";
  const isLoginReq  = scoreBasis === "login_required";
  const displayScore = isLoading ? "0" : isLimited ? "🔒" : isLoginReq ? "🔑" : isEstimated ? `~${matchScore}` : `${matchScore}`;

  const tierLabel =
    isLimited   ? "Upgrade for scores" :
    isLoginReq  ? "Log in to see score" :
    matchScore >= 85 ? "🟢 Excellent" :
    matchScore >= 70 ? "🔵 Good" :
    matchScore >= 50 ? "🟡 Fair" : "🔴 Low";

  const tierSuffix = isEstimated ? " (est.)" : isLoading ? "…" : "";

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
        <div class="af-score-ring" style="position:relative;width:90px;height:90px;flex-shrink:0;">
          <svg width="90" height="90" viewBox="0 0 90 90" style="position:absolute;top:0;left:0;">
            <!-- background track -->
            <circle cx="45" cy="45" r="${ARC_R}" fill="none"
              stroke="rgba(255,255,255,0.08)" stroke-width="5.5"/>
            <!-- animated score arc — starts at top (rotated -90°) -->
            <circle cx="45" cy="45" r="${ARC_R}" fill="none"
              stroke="${_scoreColor(isLoading ? 0 : matchScore)}" stroke-width="5.5"
              stroke-linecap="round"
              stroke-dasharray="${ARC_C.toFixed(2)}"
              stroke-dashoffset="${(ARC_C * (1 - (isLoading ? 0 : matchScore) / 100)).toFixed(2)}"
              class="af-score-arc"
              transform="rotate(-90 45 45)"
              style="transition:stroke-dashoffset 0.08s linear,stroke 0.35s ease;"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;">
            <span class="af-score-value" style="font-size:${isLimited ? "18" : "24"}px;font-weight:800;color:#fff;line-height:1;">${displayScore}</span>
            <span class="af-score-label" style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:0.08em;text-transform:uppercase;">MATCH</span>
          </div>
        </div>
        <div class="af-score-info">
          <p class="af-company">${jobData.company}</p>
          <p class="af-title">${jobData.title}</p>
          <p class="af-tier">${tierLabel} Match${tierSuffix}</p>
        </div>
      </div>
      <div class="af-actions" id="af-actions">
        ${actionsHtml}
      </div>
    </div>
    <button class="af-bubble" id="af-bubble">
      <span class="af-bubble-logo">⚡</span>
      <span class="af-bubble-score">${displayScore}</span>
    </button>
  `;

  document.body.appendChild(container);

  // Start the count-up animation immediately after the overlay is in the DOM
  if (isLoading) startScoreAnim();

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

        // Pre-flight auth check — verify session exists and hasn't expired
        // before making the API call. Catches logout that wasn't synced yet.
        chrome.storage.local.get("session", (result) => {
          const session = result["session"] as { token?: string; expiresAt?: string } | null;
          const expired = session?.expiresAt
            ? Date.now() > new Date(session.expiresAt).getTime()
            : false;

          if (!session?.token || expired) {
            if (expired) chrome.storage.local.remove("session");
            loginRequiredToast();
            return;
          }

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
        // Use _animCurrent (live displayed score) not matchScore (was 0 for loading state)
        const liveScore = _animCurrent > 0 ? _animCurrent : matchScore;
        const liveBasis = _animCurrent > 0 ? "full_jd" : (scoreBasis || "full_jd");
        injectOverlay(liveScore, jobData, app, fingerprint, onAppSaved, liveBasis);
      },
    );
  });
}
