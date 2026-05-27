import React, { useEffect, useState } from "react";
import type { AuthSession, AppNotification } from "@applyflow/shared";

const API = "http://localhost:8000/api/v1/auth";
const WEB_BASE = "http://localhost:3000";

export default function Popup() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.storage.local.get("session", (result) => {
      setSession(result["session"] ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <Center><p style={{ color: "#6366f1" }}>Loading...</p></Center>;
  }

  if (!session) {
    return <AuthView onLogin={setSession} />;
  }

  return <DashboardView session={session} onLogout={() => setSession(null)} />;
}

function AuthView({ onLogin }: { onLogin: (s: AuthSession) => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0, color: "#6366f1", fontSize: 20 }}>⚡ ApplyFlow AI</h1>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
        {(["login", "register"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "8px 0", background: "none", border: "none",
              cursor: "pointer", fontSize: 13, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? "#6366f1" : "#6b7280",
              borderBottom: tab === t ? "2px solid #6366f1" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t === "login" ? "Sign In" : "Register"}
          </button>
        ))}
      </div>
      {tab === "login" ? (
        <LoginForm onLogin={onLogin} />
      ) : (
        <RegisterForm onLogin={onLogin} />
      )}
    </div>
  );
}

function LoginForm({ onLogin }: { onLogin: (s: AuthSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { access_token?: string; user?: { id: string; name: string; email: string }; detail?: string };
      if (!res.ok) {
        setError(data.detail ?? "Invalid email or password");
        return;
      }
      const session: AuthSession = {
        token: data.access_token!,
        user: { ...data.user!, plan: "free", createdAt: new Date().toISOString() },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      chrome.storage.local.set({ session });
      onLogin(session);
    } catch {
      setError("Could not connect to API — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
      {error && <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{error}</p>}
      <button type="submit" disabled={loading} style={btnStyle}>{loading ? "Signing in…" : "Sign In"}</button>
    </form>
  );
}

function RegisterForm({ onLogin }: { onLogin: (s: AuthSession) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json() as { access_token?: string; user?: { id: string; name: string; email: string }; detail?: string };
      if (!res.ok) {
        setError(data.detail ?? "Registration failed");
        return;
      }
      const session: AuthSession = {
        token: data.access_token!,
        user: { ...data.user!, plan: "free", createdAt: new Date().toISOString() },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      chrome.storage.local.set({ session });
      onLogin(session);
    } catch {
      setError("Could not connect to API — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
      {error && <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{error}</p>}
      <button type="submit" disabled={loading} style={btnStyle}>{loading ? "Creating account…" : "Create Account"}</button>
    </form>
  );
}

function timeAgoPopup(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_ICON: Record<string, string> = {
  success: "✅", error: "❌", info: "ℹ️", warning: "⚠️",
};

function NotificationCard({ n, onAction }: { n: AppNotification; onAction: (n: AppNotification) => void }) {
  return (
    <div style={{
      padding: "10px 12px",
      borderRadius: 10,
      background: n.read ? "rgba(0,0,0,0.02)" : "rgba(99,102,241,0.06)",
      border: `1px solid ${n.read ? "#e5e7eb" : "rgba(99,102,241,0.2)"}`,
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{TYPE_ICON[n.type] ?? "🔔"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.3 }}>{n.title}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>{n.body}</p>
        </div>
        <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0, marginTop: 2 }}>{timeAgoPopup(n.timestamp)}</span>
      </div>
      {n.action && (
        <button
          onClick={() => onAction(n)}
          style={{
            alignSelf: "flex-start",
            marginTop: 4,
            padding: "4px 10px",
            background: "rgba(99,102,241,0.1)",
            border: "1px solid rgba(99,102,241,0.25)",
            borderRadius: 6,
            color: "#6366f1",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {n.action.label} →
        </button>
      )}
    </div>
  );
}

function DashboardView({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    chrome.storage.local.get("af_notifications", (result) => {
      const list = (result["af_notifications"] ?? []) as AppNotification[];
      setNotifications(list);
    });
    // Mark all as read and clear badge
    chrome.runtime.sendMessage({ type: "MARK_NOTIFICATIONS_READ" });
  }, []);

  function handleAction(n: AppNotification) {
    if (n.action?.resumeId) {
      chrome.storage.local.set({ af_open_resume: { resumeId: n.action.resumeId, applicationId: n.action.applicationId ?? "" } });
      chrome.tabs.create({ url: `${WEB_BASE}/resume` });
    }
  }

  function handleLogout() {
    chrome.storage.local.remove("session");
    onLogout();
  }

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, minHeight: 300 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, color: "#6366f1", fontSize: 18 }}>⚡ ApplyFlow AI</h1>
        <button onClick={handleLogout} style={{ ...btnStyle, background: "#f3f4f6", color: "#374151", fontSize: 12, padding: "4px 10px" }}>
          Sign out
        </button>
      </div>

      <p style={{ margin: 0, color: "#374151", fontSize: 13 }}>
        Welcome, <strong>{session.user.name}</strong>
      </p>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Notifications {unread > 0 && (
              <span style={{ marginLeft: 6, background: "#6366f1", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>
                {unread}
              </span>
            )}
          </p>
        </div>

        {notifications.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>
            No notifications yet
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifications.slice(0, 8).map(n => (
              <NotificationCard key={n.id} n={n} onAction={handleAction} />
            ))}
          </div>
        )}
      </div>

      <p style={{ margin: 0, color: "#9ca3af", fontSize: 12, borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
        Open a LinkedIn job listing to see your match score.
      </p>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 480 }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 14,
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  padding: "10px 16px",
  background: "#6366f1",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontSize: 14,
  cursor: "pointer",
};
