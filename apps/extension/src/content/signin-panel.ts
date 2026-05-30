const API_BASE = "http://localhost:8000";
const PANEL_ID  = "applyflow-signin-panel";
const STYLES_ID = "applyflow-signin-styles";

function injectStyles() {
  if (document.getElementById(STYLES_ID)) return;
  const s = document.createElement("style");
  s.id = STYLES_ID;
  s.textContent = `
    #${PANEL_ID} {
      position: fixed; top: 50%; right: 16px; transform: translateY(-50%);
      z-index: 2147483648; width: 300px;
      background: #1a1a2e; border: 1px solid rgba(99,102,241,0.4);
      border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.6);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px; color: #e2e2f0; overflow: hidden;
      animation: af-si-in 0.2s ease;
    }
    @keyframes af-si-in {
      from { opacity: 0; transform: translateY(-50%) translateX(20px); }
      to   { opacity: 1; transform: translateY(-50%) translateX(0); }
    }
    #${PANEL_ID} .af-si-hd {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.07);
      background: rgba(99,102,241,0.1);
    }
    #${PANEL_ID} .af-si-title { font-size: 14px; font-weight: 700; color: #c7d2fe; }
    #${PANEL_ID} .af-si-x {
      cursor: pointer; color: #9ca3af; font-size: 18px; line-height: 1;
      transition: color 0.1s;
    }
    #${PANEL_ID} .af-si-x:hover { color: #e2e2f0; }
    #${PANEL_ID} .af-si-body { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    #${PANEL_ID} .af-si-input {
      width: 100%; box-sizing: border-box;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px; color: #e2e2f0; font-size: 13px;
      padding: 9px 12px; outline: none; font-family: inherit;
    }
    #${PANEL_ID} .af-si-input:focus { border-color: rgba(99,102,241,0.6); }
    #${PANEL_ID} .af-si-input::placeholder { color: rgba(255,255,255,0.3); }
    #${PANEL_ID} .af-si-btn {
      width: 100%; padding: 10px; background: #6366f1; border: none;
      border-radius: 8px; color: #fff; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: background 0.15s;
    }
    #${PANEL_ID} .af-si-btn:hover:not(:disabled) { background: #5558e3; }
    #${PANEL_ID} .af-si-btn:disabled { opacity: 0.6; cursor: default; }
    #${PANEL_ID} .af-si-err { color: #fca5a5; font-size: 12px; text-align: center; }
  `;
  document.head.appendChild(s);
}

export function showSignInPanel(onSuccess?: () => void): void {
  document.getElementById(PANEL_ID)?.remove();
  injectStyles();

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="af-si-hd">
      <span class="af-si-title">⚡ ApplyFlow · Sign In</span>
      <span class="af-si-x">✕</span>
    </div>
    <div class="af-si-body">
      <input class="af-si-input" id="af-si-email" type="email" placeholder="Email" autocomplete="email" />
      <input class="af-si-input" id="af-si-pw" type="password" placeholder="Password" autocomplete="current-password" />
      <div class="af-si-err" id="af-si-err" style="display:none"></div>
      <button class="af-si-btn" id="af-si-submit">Sign In →</button>
    </div>
  `;

  const emailEl  = panel.querySelector<HTMLInputElement>("#af-si-email")!;
  const pwEl     = panel.querySelector<HTMLInputElement>("#af-si-pw")!;
  const errEl    = panel.querySelector<HTMLElement>("#af-si-err")!;
  const submitEl = panel.querySelector<HTMLButtonElement>("#af-si-submit")!;

  panel.querySelector(".af-si-x")?.addEventListener("click", () => panel.remove());

  async function submit() {
    const email    = emailEl.value.trim();
    const password = pwEl.value;
    if (!email || !password) {
      errEl.textContent = "Please enter email and password.";
      errEl.style.display = "block";
      return;
    }
    submitEl.disabled = true;
    submitEl.textContent = "Signing in…";
    errEl.style.display = "none";
    // Route through background service worker to avoid CORS —
    // content scripts run in the host page's origin (e.g. linkedin.com)
    // which would be blocked by the API's CORS policy on a direct fetch.
    chrome.runtime.sendMessage(
      { type: "AUTH_LOGIN", payload: { email, password } },
      (result: { ok?: boolean; data?: { access_token: string; user: { id: string; name: string; email: string } }; error?: string } | null) => {
        if (chrome.runtime.lastError || !result) {
          errEl.textContent = "Could not connect — is the server running?";
          errEl.style.display = "block";
          submitEl.disabled = false;
          submitEl.textContent = "Sign In →";
          return;
        }
        if (result.error || !result.ok) {
          errEl.textContent = result.error ?? "Invalid email or password.";
          errEl.style.display = "block";
          submitEl.disabled = false;
          submitEl.textContent = "Sign In →";
          return;
        }
        const { data } = result;
        chrome.storage.local.set({
          session: {
            token: data!.access_token,
            user: { ...data!.user, plan: "free", createdAt: new Date().toISOString() },
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        });
        panel.remove();
        onSuccess?.();
      },
    );
  }

  submitEl.addEventListener("click", () => void submit());
  panel.addEventListener("keydown", (e) => { if (e.key === "Enter") void submit(); });

  document.body.appendChild(panel);
  setTimeout(() => emailEl.focus(), 50);
}
