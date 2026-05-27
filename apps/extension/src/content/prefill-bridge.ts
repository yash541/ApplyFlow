// Runs on localhost:3000/resume* — bridges extension chrome.storage into the page via events.

// ── Tailor prefill ────────────────────────────────────────────────────────────
// Triggered by "Tailor Resume" button in the overlay. Passes jd/company/role
// (and optionally applicationId) so the web app can pre-fill and start tailoring.
chrome.storage.local.get("af_tailor_prefill", (result) => {
  const data = result["af_tailor_prefill"] as {
    jd?: string; company?: string; role?: string; applicationId?: string;
  } | undefined;
  if (!data) return;
  chrome.storage.local.remove("af_tailor_prefill");

  // sessionStorage covers the case where the bridge runs before React mounts
  try { sessionStorage.setItem("af_tailor_prefill", JSON.stringify(data)); } catch { /* ignore */ }
  // Custom event covers the case where React is already mounted
  window.dispatchEvent(new CustomEvent("af_prefill_ready", { detail: data }));
});

// ── Open resume ───────────────────────────────────────────────────────────────
// Triggered by "Open Resume" button in the overlay. Passes resumeId + applicationId
// so the web app loads that specific tailored resume directly into the editor.
chrome.storage.local.get("af_open_resume", (result) => {
  const data = result["af_open_resume"] as {
    resumeId: string; applicationId: string;
  } | undefined;
  if (!data) return;
  chrome.storage.local.remove("af_open_resume");

  try { sessionStorage.setItem("af_open_resume", JSON.stringify(data)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("af_open_resume", { detail: data }));
});

// ── Resume saved ──────────────────────────────────────────────────────────────
// Triggered by the ResumeSplitEditor after a successful DB save.
// Pushes a persistent notification + writes a pending toast for the LinkedIn page.
window.addEventListener("af_resume_saved", (e) => {
  const data = (e as CustomEvent<{
    resumeId: string;
    applicationId: string;
    company: string;
    role: string;
    jobUrl: string | null;
  }>).detail;

  // Persistent popup notification
  chrome.runtime.sendMessage({
    type: "NOTIFY",
    payload: {
      type: "success",
      title: "Resume saved!",
      body: `${data.company} · ${data.role}`,
      action: {
        label: "Open Resume",
        resumeId: data.resumeId,
        applicationId: data.applicationId,
      },
    },
  });

  // Pending toast shown on the job page after redirect
  chrome.storage.local.set({
    af_pending_toast: {
      type: "success",
      title: "Resume ready! ✓",
      body: `${data.company} · ${data.role}`,
      action: {
        label: "Open Resume →",
        resumeId: data.resumeId,
        applicationId: data.applicationId,
      },
    },
  });
});
