/**
 * "Activate ApplyFlow" fallback banner.
 *
 * Shown in the bottom-right corner when autofill.ts is injected on a page
 * but detects zero actionable fields after the DOM has settled. Gives the
 * user a single-click way to trigger a fresh field scan without requiring
 * them to open the extension popup.
 *
 * Lifecycle:
 *   showActivateBanner(onActivate) — mounts the banner
 *   onActivate()                   — called when user clicks; should re-run
 *                                    the field scan and return a boolean:
 *                                    true  → fields found (banner hides itself)
 *                                    false → no fields (brief error, then hides)
 *   hideActivateBanner()           — imperatively removes the banner (e.g. when
 *                                    the badge appears after a MutationObserver fire)
 */

const BANNER_ID   = "af-activate-banner";
const STYLE_ID    = "af-activate-banner-styles";

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    #${BANNER_ID} {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483646;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      animation: af-banner-in 0.2s ease;
    }
    @keyframes af-banner-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0);   }
    }
    #${BANNER_ID} .af-ab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: rgba(17, 24, 39, 0.94);
      border: 1px solid rgba(99, 102, 241, 0.45);
      border-radius: 10px;
      color: #c7d2fe;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.35);
      white-space: nowrap;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      line-height: 1;
    }
    #${BANNER_ID} .af-ab-btn:hover:not(:disabled) {
      background: rgba(99, 102, 241, 0.22);
      border-color: rgba(99, 102, 241, 0.75);
      color: #fff;
    }
    #${BANNER_ID} .af-ab-btn:disabled {
      opacity: 0.65;
      cursor: default;
    }
    #${BANNER_ID} .af-ab-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #6366f1;
      flex-shrink: 0;
    }
  `;
  document.head?.appendChild(s);
}

export function showActivateBanner(onActivate: () => Promise<boolean>): void {
  if (document.getElementById(BANNER_ID)) return;

  injectStyles();

  const el = document.createElement("div");
  el.id = BANNER_ID;
  el.innerHTML = `
    <button class="af-ab-btn" id="af-ab-btn">
      <div class="af-ab-dot"></div>
      <span id="af-ab-label">Activate ApplyFlow</span>
    </button>
  `;
  document.body?.appendChild(el);

  const btn   = el.querySelector<HTMLButtonElement>("#af-ab-btn")!;
  const label = el.querySelector<HTMLElement>("#af-ab-label")!;

  btn.addEventListener("click", async () => {
    btn.disabled   = true;
    label.textContent = "Scanning…";

    let fieldsFound = false;
    try {
      fieldsFound = await onActivate();
    } catch { /* silently degrade */ }

    if (!fieldsFound) {
      label.textContent = "No fields found";
      setTimeout(hideActivateBanner, 2000);
    }
    // If fieldsFound, run() will call hideActivateBanner() when it renders the badge
  });
}

export function hideActivateBanner(): void {
  document.getElementById(BANNER_ID)?.remove();
}

export function isActivateBannerVisible(): boolean {
  return !!document.getElementById(BANNER_ID);
}
