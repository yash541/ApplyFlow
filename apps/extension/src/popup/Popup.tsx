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

function AuthView({ onLogin }: { onLogin: (s: AuthSession) => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0, color: "#6366f1", fontSize: 20 }}>⚡ ApplyFlow AI</h1>
      </div>
      <TabRow tabs={["login", "register"] as const} active={tab} onSelect={setTab}
        labels={{ login: "Sign In", register: "Register" }} />
      {tab === "login" ? <LoginForm onLogin={onLogin} /> : <RegisterForm onLogin={onLogin} />}
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
      margin: "0 16px 10px",
      padding: "12px",
      borderRadius: 10,
      background: "rgba(99,102,241,0.06)",
      border: "1px solid rgba(99,102,241,0.2)",
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>🌐</span>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1e1b4b" }}>
            Enable autofill on all job sites
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>
            Right now autofill only works on ~14 pre-configured portals. Grant
            permission once to get the badge on <strong>any</strong> ATS — Naukri,
            Workday, Taleo, custom company pages, and more.
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleEnable}
          disabled={requesting}
          style={{ ...btnStyle, flex: 1, fontSize: 12, padding: "8px 12px" }}
        >
          {requesting ? "Requesting…" : "Enable on all sites →"}
        </button>
        <button
          onClick={() => setState("hidden")}
          style={{ ...btnSmall, background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb", fontSize: 12 }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function DashboardView({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  function handleLogout() { chrome.storage.local.remove("session"); onLogout(); }

  return (
    <div style={{ width: 380, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 0" }}>
        <h1 style={{ margin: 0, color: "#6366f1", fontSize: 17, fontWeight: 700 }}>⚡ ApplyFlow AI</h1>
        <button onClick={handleLogout} style={{ ...btnStyle, background: "#f3f4f6", color: "#374151", fontSize: 11, padding: "4px 10px" }}>
          Sign out
        </button>
      </div>
      <p style={{ margin: "4px 16px 12px", color: "#6b7280", fontSize: 12 }}>
        {session.user.name}
      </p>

      {/* Permission banner — shown only when <all_urls> not yet granted */}
      <UniversalPermissionBanner />

      {/* Quick links */}
      <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={() => chrome.tabs.create({ url: "http://localhost:3000/applications" })}
          style={{ ...btnStyle, width: "100%", background: "rgba(99,102,241,0.08)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.2)", fontSize: 13 }}
        >
          Open tracker →
        </button>
        <button
          onClick={() => chrome.tabs.create({ url: "http://localhost:3000/resume" })}
          style={{ ...btnStyle, width: "100%", background: "transparent", color: "#9ca3af", border: "1px solid #e5e7eb", fontSize: 13 }}
        >
          Resume Lab →
        </button>
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
