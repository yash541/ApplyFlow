import React, { useEffect, useState, useCallback } from "react";
import type { AuthSession, AppNotification } from "@applyflow/shared";

const API      = "http://localhost:8000/api/v1/auth";
const API_BASE = "http://localhost:8000/api/v1";
const WEB_BASE = "http://localhost:3000";

// ── Shared helpers ────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_COLOR: Record<string, string> = {
  saved: "#3b82f6", applied: "#6366f1", screening: "#6366f1",
  interview: "#f59e0b", technical: "#f59e0b",
  offer: "#10b981", rejected: "#6b7280",
};
const STATUS_LABEL: Record<string, string> = {
  saved: "Saved", applied: "Applied", screening: "Applied",
  interview: "Interview", technical: "Interview",
  offer: "Offer", rejected: "Rejected",
};

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Popup() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.storage.local.get("session", (result) => {
      setSession(result["session"] ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) return <Center><Spinner /></Center>;
  if (!session)  return <AuthView onLogin={setSession} />;
  return <DashboardView session={session} onLogout={() => setSession(null)} />;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function AuthView({ onLogin: _onLogin }: { onLogin: (s: AuthSession) => void }) {
  const { enabled, toggle } = useEnabled();
  function openLogin() { chrome.tabs.create({ url: "http://localhost:3000/login" }); }

  return (
    <div style={{
      width: 300, background: "linear-gradient(135deg,#0f0f1a 0%,#1a1a2e 100%)",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ width: 28, height: 28, background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚡</div>
        <span style={{ color: "#c7d2fe", fontSize: 14, fontWeight: 700, flex: 1 }}>ApplyFlow AI</span>
      </div>

      {/* Enable/Disable toggle — always visible regardless of auth */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: enabled ? "#c7d2fe" : "#6b7280" }}>Extension {enabled ? "Active" : "Paused"}</p>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: "#4b5563" }}>{enabled ? "Overlay & autofill running" : "All features paused"}</p>
        </div>
        <button onClick={toggle} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: enabled ? "#6366f1" : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
          <span style={{ position: "absolute", top: 2, left: enabled ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
        </button>
      </div>

      {/* Login prompt */}
      <div style={{ padding: "16px 16px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>Sign in to track & autofill</p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "#4b5563" }}>Track jobs, autofill forms, tailor resumes</p>
        </div>
        <button onClick={openLogin} style={{ width: "100%", padding: "9px 16px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          onMouseEnter={e => { (e.target as HTMLElement).style.background = "#4f46e5"; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.background = "#6366f1"; }}
        >
          ⚡ Log in to ApplyFlow →
        </button>
        <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.18)", textAlign: "center" }}>Login on web app — extension syncs automatically</p>
      </div>
    </div>
  );
}

function LoginForm({ onLogin }: { onLogin: (s: AuthSession) => void }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res  = await fetch(`${API}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json() as { access_token?: string; user?: { id: string; name: string; email: string }; detail?: string };
      if (!res.ok) { setError(data.detail ?? "Invalid email or password"); return; }
      const s: AuthSession = { token: data.access_token!, user: { ...data.user!, plan: "free", createdAt: new Date().toISOString() }, expiresAt: new Date(Date.now() + 86400000).toISOString() };
      chrome.storage.local.set({ session: s }); onLogin(s);
    } catch { setError("Could not connect — is the API running?"); }
    finally  { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
      {error && <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{error}</p>}
      <button type="submit" disabled={loading} style={btnStyle}>{loading ? "Signing in…" : "Sign In"}</button>
    </form>
  );
}

function RegisterForm({ onLogin }: { onLogin: (s: AuthSession) => void }) {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res  = await fetch(`${API}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
      const data = await res.json() as { access_token?: string; user?: { id: string; name: string; email: string }; detail?: string };
      if (!res.ok) { setError(data.detail ?? "Registration failed"); return; }
      const s: AuthSession = { token: data.access_token!, user: { ...data.user!, plan: "free", createdAt: new Date().toISOString() }, expiresAt: new Date(Date.now() + 86400000).toISOString() };
      chrome.storage.local.set({ session: s }); onLogin(s);
    } catch { setError("Could not connect — is the API running?"); }
    finally  { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
      {error && <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{error}</p>}
      <button type="submit" disabled={loading} style={btnStyle}>{loading ? "Creating…" : "Create Account"}</button>
    </form>
  );
}

// ── Universal permission banner ───────────────────────────────────────────────

type PermState = "checking" | "needed" | "granted" | "hidden";

function UniversalPermissionBanner() {
  const [state, setState] = useState<PermState>("checking");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const has = await chrome.permissions.contains({ origins: ["<all_urls>"] });
        setState(has ? "granted" : "needed");
      } catch {
        setState("hidden"); // permissions API unavailable
      }
    }
    void check();
  }, []);

  async function handleEnable() {
    setRequesting(true);
    try {
      const granted = await chrome.permissions.request({ origins: ["<all_urls>"] });
      setState(granted ? "granted" : "needed");
    } catch {
      setState("hidden");
    } finally {
      setRequesting(false);
    }
  }

  if (state === "checking" || state === "hidden" || state === "granted") return null;

  // state === "needed"
  return (
    <div style={{
      margin: "10px 12px",
      padding: "12px",
      borderRadius: 10,
      background: "rgba(99,102,241,0.1)",
      border: "1px solid rgba(99,102,241,0.25)",
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>🌐</span>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#c7d2fe" }}>
            Enable on all job sites
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "#6b7280", lineHeight: 1.4 }}>
            Grant once to get autofill on any ATS — Naukri, Workday, Taleo and more.
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleEnable} disabled={requesting} style={{
          flex: 1, padding: "7px 10px", background: "#6366f1", color: "#fff",
          border: "none", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
        }}>
          {requesting ? "Requesting…" : "Enable →"}
        </button>
        <button onClick={() => setState("hidden")} style={{
          padding: "7px 10px", background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
          color: "#6b7280", fontSize: 11, cursor: "pointer",
        }}>
          Not now
        </button>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function useEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    chrome.storage.local.get("af_enabled", r => {
      setEnabled(r["af_enabled"] !== false); // default true
    });
  }, []);
  function toggle() {
    const next = !enabled;
    setEnabled(next);
    chrome.storage.local.set({ af_enabled: next });
  }
  return { enabled: enabled ?? true, toggle };
}

function DashboardView({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const { enabled, toggle } = useEnabled();
  function handleLogout() { chrome.storage.local.remove("session"); onLogout(); }
  const initials = session.user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const S = {
    wrap: { width: 300, background: "linear-gradient(135deg,#0f0f1a 0%,#1a1a2e 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" } as React.CSSProperties,
    hdr: { display: "flex", alignItems: "center", gap: 8, padding: "14px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" } as React.CSSProperties,
    icon: { width: 28, height: 28, background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 } as React.CSSProperties,
    row: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" } as React.CSSProperties,
    avatar: { width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 } as React.CSSProperties,
    footer: { padding: "8px 16px 10px", display: "flex", justifyContent: "center" } as React.CSSProperties,
  };

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.hdr}>
        <div style={S.icon}>⚡</div>
        <span style={{ color: "#c7d2fe", fontSize: 14, fontWeight: 700, flex: 1 }}>ApplyFlow AI</span>
      </div>

      {/* User card */}
      <div style={S.row}>
        <div style={S.avatar}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#f0f0ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.user.name}</p>
          <p style={{ margin: "1px 0 0", fontSize: 10, color: "#4b5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.user.email}</p>
        </div>
        <button onClick={handleLogout}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#9ca3af", fontSize: 11, fontWeight: 500, cursor: "pointer", padding: "5px 10px", flexShrink: 0 }}
          onMouseEnter={e => Object.assign((e.target as HTMLElement).style, { background: "rgba(239,68,68,0.15)", color: "#f87171", borderColor: "rgba(239,68,68,0.3)" })}
          onMouseLeave={e => Object.assign((e.target as HTMLElement).style, { background: "rgba(255,255,255,0.05)", color: "#9ca3af", borderColor: "rgba(255,255,255,0.1)" })}
        >Sign out</button>
      </div>

      {/* Enable / Disable toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: enabled ? "#c7d2fe" : "#6b7280" }}>Extension {enabled ? "Active" : "Paused"}</p>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: "#4b5563" }}>{enabled ? "Overlay & autofill running" : "All features paused"}</p>
        </div>
        {/* Toggle switch */}
        <button onClick={toggle} style={{
          width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
          background: enabled ? "#6366f1" : "rgba(255,255,255,0.1)",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}>
          <span style={{
            position: "absolute", top: 2, left: enabled ? 22 : 2,
            width: 20, height: 20, borderRadius: "50%", background: "#fff",
            transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }} />
        </button>
      </div>

      {/* Permission banner */}
      <UniversalPermissionBanner />

      <div style={S.footer}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)" }}>Log in on web app — syncs automatically</span>
      </div>
    </div>
  );
}

// ── Activity tab (notifications) ──────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };

function ActivityTab({ session }: { session: AuthSession }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    chrome.storage.local.get("af_notifications", (result) => {
      setNotifications((result["af_notifications"] ?? []) as AppNotification[]);
    });
    chrome.runtime.sendMessage({ type: "MARK_NOTIFICATIONS_READ" });
  }, []);

  const unread = notifications.filter(n => !n.read).length;

  function handleAction(n: AppNotification) {
    if (n.action?.resumeId) {
      chrome.storage.local.set({ af_open_resume: { resumeId: n.action.resumeId, applicationId: n.action.applicationId ?? "" } });
      chrome.tabs.create({ url: `${WEB_BASE}/resume` });
    }
  }

  return (
    <div style={{ padding: "12px 16px 16px", overflowY: "auto", maxHeight: 340 }}>
      <SectionLabel>
        Notifications {unread > 0 && <Badge>{unread}</Badge>}
      </SectionLabel>
      {notifications.length === 0 ? (
        <EmptyState>No notifications yet</EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifications.slice(0, 8).map(n => (
            <div key={n.id} style={{
              padding: "10px 12px", borderRadius: 10,
              background: n.read ? "rgba(0,0,0,0.02)" : "rgba(99,102,241,0.06)",
              border: `1px solid ${n.read ? "#e5e7eb" : "rgba(99,102,241,0.2)"}`,
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{TYPE_ICON[n.type] ?? "🔔"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.3 }}>{n.title}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>{n.body}</p>
                </div>
                <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0, marginTop: 2 }}>{timeAgo(n.timestamp)}</span>
              </div>
              {n.action && (
                <button onClick={() => handleAction(n)} style={{
                  alignSelf: "flex-start", marginTop: 4, padding: "4px 10px",
                  background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
                  borderRadius: 6, color: "#6366f1", fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}>
                  {n.action.label} →
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <p style={{ margin: "12px 0 0", color: "#9ca3af", fontSize: 12 }}>
        Open a LinkedIn job listing to see your match score.
      </p>
    </div>
  );
}

// ── Applications tab ──────────────────────────────────────────────────────────

type AppRecord = {
  id: string; company: string; role: string; status: string;
  applied_at: string; job_url: string | null;
  has_resume: boolean; ats_score: number | null;
};

function ApplicationsTab({ token }: { token: string }) {
  const [apps, setApps]       = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tracked, setTracked]   = useState<AppRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/applications/?limit=8`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { applications?: AppRecord[] };
        setApps(data.applications ?? []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Center style={{ height: 200 }}><Spinner /></Center>;

  if (tracked) {
    return (
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center" }}>
        <span style={{ fontSize: 36 }}>✅</span>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#111827" }}>Job tracked!</p>
        <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{tracked.company} · {tracked.role}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={() => { setTracked(null); void load(); }} style={{ ...btnSmall, background: "rgba(99,102,241,0.1)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.3)" }}>
            View all →
          </button>
          <button onClick={() => chrome.tabs.create({ url: `${WEB_BASE}/applications` })} style={btnSmall}>
            Open tracker →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* App list */}
      <div style={{ overflowY: "auto", maxHeight: showForm ? 160 : 290, padding: "12px 16px 0" }}>
        <SectionLabel>Recent applications</SectionLabel>
        {apps.length === 0 ? (
          <EmptyState>No applications tracked yet</EmptyState>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {apps.map(app => (
              <AppRow key={app.id} app={app} />
            ))}
          </div>
        )}
      </div>

      {/* Track form / toggle */}
      <div style={{ padding: "10px 16px 16px", borderTop: "1px solid #f3f4f6", marginTop: 8 }}>
        {showForm ? (
          <TrackForm
            token={token}
            onSuccess={(app) => { setShowForm(false); setTracked(app); }}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <button onClick={() => setShowForm(true)} style={{ ...btnStyle, fontSize: 13, padding: "9px 16px", width: "100%" }}>
            + Track current page
          </button>
        )}
      </div>
    </div>
  );
}

function AppRow({ app }: { app: AppRecord }) {
  const color = STATUS_COLOR[app.status] ?? "#6b7280";
  const label = STATUS_LABEL[app.status] ?? app.status;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 10px", borderRadius: 8, cursor: "pointer",
      transition: "background 0.1s",
    }}
      onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      onClick={() => chrome.tabs.create({ url: `${WEB_BASE}/applications` })}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {app.company}
        </p>
        <p style={{ margin: "1px 0 0", fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {app.role}
        </p>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
        background: `${color}18`, color, border: `1px solid ${color}44`,
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0 }}>{timeAgo(app.applied_at)}</span>
    </div>
  );
}

function TrackForm({
  token,
  onSuccess,
  onCancel,
  inline,
}: {
  token: string;
  onSuccess: (app: AppRecord) => void;
  onCancel: () => void;
  inline?: boolean;
}) {
  const [company, setCompany] = useState("");
  const [role, setRole]       = useState("");
  const [url, setUrl]         = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [saved, setSaved]     = useState(false);

  // Pre-fill URL from active tab
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabUrl = tabs[0]?.url ?? "";
      // Skip extension/chrome pages
      if (tabUrl.startsWith("http")) setUrl(tabUrl);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() || !role.trim()) return;
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/applications/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ company: company.trim(), role: role.trim(), job_url: url || null, status: "applied" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { detail?: string };
        setError(err.detail ?? "Failed to save"); return;
      }
      const data = await res.json() as AppRecord;
      if (inline) {
        // In-place success — reset form after a brief confirmation
        setSaved(true);
        setTimeout(() => { setSaved(false); setCompany(""); setRole(""); }, 2000);
      } else {
        onSuccess(data);
      }
    } catch { setError("API unavailable"); }
    finally  { setSaving(false); }
  }

  if (saved) {
    return (
      <div style={{ padding: "12px", textAlign: "center", background: "rgba(16,185,129,0.08)", borderRadius: 10, border: "1px solid rgba(16,185,129,0.25)" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#065f46" }}>✅ Job tracked!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600, color: "#374151" }}>Track current page as Applied</p>
      <input
        type="text" placeholder="Company name" value={company}
        onChange={e => setCompany(e.target.value)} required style={inputStyle}
      />
      <input
        type="text" placeholder="Role / job title" value={role}
        onChange={e => setRole(e.target.value)} required style={inputStyle}
      />
      <input
        type="text" placeholder="Job URL" value={url}
        onChange={e => setUrl(e.target.value)} style={{ ...inputStyle, fontSize: 11, color: "#6b7280" }}
      />
      {error && <p style={{ margin: 0, fontSize: 11, color: "#ef4444" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={saving || !company.trim() || !role.trim()} style={{ ...btnStyle, flex: 1, fontSize: 13, padding: "8px 12px" }}>
          {saving ? "Saving…" : "Track →"}
        </button>
        {!inline && (
          <button type="button" onClick={onCancel} style={{ ...btnSmall, background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function TabRow<T extends string>({
  tabs, active, onSelect, labels, style,
}: {
  tabs: readonly T[];
  active: T;
  onSelect: (t: T) => void;
  labels: Record<T, string>;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", ...style }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onSelect(t)} style={{
          flex: 1, padding: "7px 0", background: "none", border: "none",
          cursor: "pointer", fontSize: 13, fontWeight: active === t ? 600 : 400,
          color: active === t ? "#6366f1" : "#6b7280",
          borderBottom: active === t ? "2px solid #6366f1" : "2px solid transparent",
          marginBottom: -1,
        }}>
          {labels[t]}
        </button>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {children}
    </p>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ marginLeft: 6, background: "#6366f1", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>
      {children}
    </span>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>
      {children}
    </p>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 20, height: 20,
      border: "2px solid rgba(99,102,241,0.25)",
      borderTopColor: "#6366f1",
      borderRadius: "50%",
      animation: "spin 0.75s linear infinite",
    }} />
  );
}

function Center({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 480, ...style }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
  padding: "10px 16px",
  background: "#6366f1",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 600,
};

const btnSmall: React.CSSProperties = {
  padding: "7px 14px",
  background: "#6366f1",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontSize: 12,
  cursor: "pointer",
  fontWeight: 600,
};
