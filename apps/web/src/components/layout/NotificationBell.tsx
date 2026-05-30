"use client";

import { Bell, X } from "lucide-react";
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "@/store/auth";

type Notification = {
  id: string;
  type: "success" | "info" | "warning" | "error";
  title: string;
  body: string | null;
  extra_data: Record<string, unknown> | null;
  created_at: string;
  read: boolean;
};

const TYPE_ICON: Record<string, string> = {
  success: "✅", info: "💡", warning: "⚠️", error: "❌",
};
const TYPE_COLOR: Record<string, string> = {
  success: "#10b981", info: "#6366f1", warning: "#f59e0b", error: "#ef4444",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const { token } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const btnRef   = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Position of the panel — set synchronously before first paint via useLayoutEffect
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:8000/api/v1/notifications/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotifications(await res.json() as Notification[]);
    } catch { /* server offline — silent */ }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void fetchNotifications();
    const id = setInterval(() => void fetchNotifications(), 30_000);
    return () => clearInterval(id);
  }, [token, fetchNotifications]);

  // Recalculate position whenever the panel becomes visible (before paint)
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setNotifications((p) => p.map((n) => ({ ...n, read: true })));
      try {
        await fetch("http://localhost:8000/api/v1/notifications/mark-read", {
          method: "PATCH", headers: { Authorization: `Bearer ${token ?? ""}` },
        });
      } catch { /* silent */ }
    }
  }

  async function markAllRead() {
    setNotifications((p) => p.map((n) => ({ ...n, read: true })));
    try {
      await fetch("http://localhost:8000/api/v1/notifications/mark-read", {
        method: "PATCH", headers: { Authorization: `Bearer ${token ?? ""}` },
      });
    } catch { /* silent */ }
  }

  const unread = notifications.filter((n) => !n.read).length;

  const panel = (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: pos.top,
        right: pos.right,
        width: 340,
        zIndex: 99999,
        borderRadius: 16,
        overflow: "hidden",
        background: "#0d0d1f",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.12)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 11px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bell style={{ width: 14, height: 14, color: "#818cf8" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.01em" }}>
            Notifications
          </span>
          {unread > 0 && (
            <span style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, border: "1px solid rgba(99,102,241,0.35)" }}>
              {unread} new
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{ width: 24, height: 24, borderRadius: 8, border: "none", background: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.1s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Body */}
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {notifications.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell style={{ width: 18, height: 18, color: "rgba(255,255,255,0.18)" }} />
            </div>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>No notifications yet</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", lineHeight: 1.6 }}>
              Job tracking, autofill, and submission events from the extension will appear here
            </span>
          </div>
        ) : notifications.map((n, i) => (
          <div key={n.id} style={{
            display: "flex", gap: 12, padding: "12px 16px",
            borderBottom: i < notifications.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
            borderLeft: n.read ? "2px solid transparent" : "2px solid #6366f1",
            background: n.read ? "transparent" : "rgba(99,102,241,0.04)",
            transition: "background 0.1s",
          }}>
            {/* Icon pill */}
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: `${TYPE_COLOR[n.type] ?? "#6366f1"}1a`,
              border: `1px solid ${TYPE_COLOR[n.type] ?? "#6366f1"}33`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
            }}>
              {TYPE_ICON[n.type] ?? "💡"}
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: n.read ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {n.title}
              </div>
              {n.body && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 3, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {n.body}
                </div>
              )}
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginTop: 5 }}>
                {timeAgo(n.created_at)}
              </div>
            </div>

            {!n.read && (
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", flexShrink: 0, marginTop: 6 }} />
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 10px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)" }}>{notifications.length} total</span>
          {unread > 0 && (
            <button
              onClick={() => void markAllRead()}
              style={{ fontSize: 11, color: "#818cf8", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#a5b4fc"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#818cf8"; }}
            >
              Mark all read
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Bell button */}
      <button
        ref={btnRef}
        onClick={() => void toggle()}
        style={{ position: "relative", width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)", transition: "background 0.1s, color 0.1s" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.9)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
      >
        <Bell style={{ width: 16, height: 16 }} />
        {unread > 0 ? (
          <span style={{ position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 9, background: "#6366f1", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
            {unread > 9 ? "9+" : unread}
          </span>
        ) : (
          <span style={{ position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: "50%", background: "rgba(99,102,241,0.5)" }} />
        )}
      </button>

      {/* Portal — renders directly into body, bypasses all stacking contexts */}
      {open && typeof document !== "undefined" && createPortal(panel, document.body)}
    </>
  );
}
