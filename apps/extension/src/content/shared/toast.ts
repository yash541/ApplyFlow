import type { NotificationType } from "@applyflow/shared";

export type ToastAction = { label: string; onClick: () => void };

export function showToast(
  type: NotificationType,
  title: string,
  body: string,
  action?: ToastAction,
  durationMs = 4000,
): void {
  const icons: Record<NotificationType, string> = {
    success: "⚡", error: "⚡", info: "⚡", warning: "⚡",
  };

  const el = document.createElement("div");
  el.className = `af-toast af-toast-${type}`;
  el.style.setProperty("--af-toast-duration", `${durationMs}ms`);
  el.innerHTML = `
    <div class="af-toast-icon">${icons[type]}</div>
    <div class="af-toast-body">
      <p class="af-toast-sender">ApplyFlow AI</p>
      <p class="af-toast-title">${title}</p>
      ${body ? `<p class="af-toast-message">${body}</p>` : ""}
      ${action ? `<button class="af-toast-action" id="af-toast-action">${action.label}</button>` : ""}
    </div>
    <button class="af-toast-dismiss" id="af-toast-dismiss">✕</button>
  `;

  // Position above the overlay container if it's open
  const overlayEl = document.getElementById("applyflow-overlay");
  if (overlayEl) {
    const rect = overlayEl.getBoundingClientRect();
    const bottomFromViewport = window.innerHeight - rect.top;
    el.style.bottom = `${bottomFromViewport + 12}px`;
  }

  document.body.appendChild(el);

  // Notification dot on the bubble while toast is visible
  const bubble = document.querySelector(".af-bubble");
  const dot = document.createElement("span");
  dot.className = "af-bubble-dot";
  bubble?.appendChild(dot);

  function dismiss() {
    el.classList.add("af-toast-hide");
    dot.remove();
    setTimeout(() => el.remove(), 230);
  }

  el.querySelector("#af-toast-dismiss")?.addEventListener("click", dismiss);
  if (action) {
    el.querySelector("#af-toast-action")?.addEventListener("click", () => {
      action.onClick();
      dismiss();
    });
  }

  const timer = setTimeout(dismiss, durationMs);
  el.addEventListener("mouseenter", () => clearTimeout(timer));
  el.addEventListener("mouseleave", () => setTimeout(dismiss, 1500));
}
