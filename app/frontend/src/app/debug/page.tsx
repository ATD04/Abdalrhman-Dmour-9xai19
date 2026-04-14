"use client";

import { AppShell, useApp } from "@/components/AppShell";
import { getServiceBaseUrl, checkAllServices } from "@/lib/api";
import { getAuthCookieClient, setAuthCookie, clearAuthCookie, COOKIE_NAME } from "@/lib/auth-cookie";
import { clearStoredSession } from "@/lib/user-context";
import type { AppRole } from "@/lib/user-context";
import { useState, useEffect } from "react";

export default function DebugPage() {
  const { role, setRole, isLoggedIn, userEmail, setIsLoggedIn, setUserEmail, lang, themeMode, logout } = useApp();
  const isAr = lang === "ar";
  const [health, setHealth] = useState<Record<string, boolean>>({});
  const [healthLoading, setHealthLoading] = useState(false);
  const [rawCookie, setRawCookie] = useState("");
  const [rawLocalStorage, setRawLocalStorage] = useState("");

  const isProd = process.env.NODE_ENV === "production";

  useEffect(() => {
    refreshState();
  }, [role, isLoggedIn, userEmail]);

  const refreshState = () => {
    const cookie = getAuthCookieClient();
    setRawCookie(JSON.stringify(cookie, null, 2) || "null");
    try {
      const ls = localStorage.getItem("shahem.app.session");
      setRawLocalStorage(ls ? JSON.stringify(JSON.parse(ls), null, 2) : "null");
    } catch {
      setRawLocalStorage("null");
    }
  };

  const checkHealth = async () => {
    setHealthLoading(true);
    try {
      const result = await checkAllServices();
      setHealth(result);
    } catch {
      setHealth({});
    }
    setHealthLoading(false);
  };

  const switchRole = (newRole: AppRole) => {
    setRole(newRole);
    if (isLoggedIn) {
      setAuthCookie({ email: userEmail, role: newRole, isLoggedIn: true });
    }
  };

  const forceLogin = (email: string, newRole: AppRole) => {
    setIsLoggedIn(true);
    setUserEmail(email);
    setRole(newRole);
    setAuthCookie({ email, role: newRole, isLoggedIn: true });
  };

  if (isProd) {
    return (
      <AppShell title="Debug">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-muted)" }}>
          Not available in production.
        </div>
      </AppShell>
    );
  }

  const sectionStyle: React.CSSProperties = {
    background: "var(--bg-card)", border: "1px solid var(--border-light)",
    borderRadius: 12, padding: "18px 20px", marginBottom: 16,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const,
    letterSpacing: "0.05em", marginBottom: 10,
  };
  const rowStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 13,
  };
  const badgeStyle = (ok: boolean): React.CSSProperties => ({
    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
    background: ok ? "var(--success-50)" : "var(--error-50)",
    color: ok ? "var(--success-700)" : "var(--error-700)",
  });
  const btnStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 8,
    border: "1px solid var(--border-light)", background: "var(--bg-subtle)",
    color: "var(--text-primary)", cursor: "pointer",
  };
  const activeBtnStyle: React.CSSProperties = {
    ...btnStyle, background: "var(--primary-700)", color: "var(--text-inverse)", border: "1px solid var(--primary-700)",
  };

  return (
    <AppShell title="Debug Dashboard">
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Debug Dashboard</h1>
          <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-subtle)", padding: "2px 8px", borderRadius: 4 }}>
            DEV ONLY
          </span>
        </div>

        {/* Session State */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Session State</div>
          <div style={rowStyle}><span>Logged In</span><span style={badgeStyle(isLoggedIn)}>{isLoggedIn ? "YES" : "NO"}</span></div>
          <div style={rowStyle}><span>Role</span><span style={{ fontWeight: 600 }}>{role}</span></div>
          <div style={rowStyle}><span>Email</span><span style={{ fontFamily: "monospace", fontSize: 12 }}>{userEmail || "(empty)"}</span></div>
          <div style={rowStyle}><span>Language</span><span>{lang}</span></div>
          <div style={rowStyle}><span>Theme</span><span>{themeMode}</span></div>
        </div>

        {/* Cookie */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Auth Cookie ({COOKIE_NAME})</div>
          <pre style={{ fontSize: 11, background: "var(--bg-subtle)", padding: 12, borderRadius: 8, overflow: "auto", maxHeight: 200, margin: 0 }}>
            {rawCookie}
          </pre>
        </div>

        {/* localStorage */}
        <div style={sectionStyle}>
          <div style={labelStyle}>localStorage (shahem.app.session)</div>
          <pre style={{ fontSize: 11, background: "var(--bg-subtle)", padding: 12, borderRadius: 8, overflow: "auto", maxHeight: 200, margin: 0 }}>
            {rawLocalStorage}
          </pre>
        </div>

        {/* Service Health */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={labelStyle}>Service Health</div>
            <button onClick={checkHealth} disabled={healthLoading} style={btnStyle}>
              {healthLoading ? "Checking..." : "Check Health"}
            </button>
          </div>
          {Object.keys(health).length > 0 ? (
            Object.entries(health).map(([service, ok]) => (
              <div key={service} style={rowStyle}>
                <span>{service}</span>
                <span style={badgeStyle(ok)}>{ok ? "HEALTHY" : "DOWN"}</span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Click "Check Health" to test service connectivity.</div>
          )}
        </div>

        {/* Environment */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Environment</div>
          {(["agent", "knowledge", "governance", "workflow"] as const).map((svc) => (
            <div key={svc} style={rowStyle}>
              <span>{svc}</span>
              <span style={{ fontFamily: "monospace", fontSize: 11 }}>{getServiceBaseUrl(svc)}</span>
            </div>
          ))}
          <div style={rowStyle}><span>NODE_ENV</span><span style={{ fontFamily: "monospace", fontSize: 11 }}>{process.env.NODE_ENV}</span></div>
        </div>

        {/* Role Switcher */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Role Switcher</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {(["citizen", "operator", "admin"] as AppRole[]).map((r) => (
              <button key={r} onClick={() => switchRole(r)} style={role === r ? activeBtnStyle : btnStyle}>
                {r}
              </button>
            ))}
          </div>
          <div style={labelStyle}>Quick Login</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button onClick={() => forceLogin("test@citizen.jo", "citizen")} style={btnStyle}>Login as Citizen</button>
            <button onClick={() => forceLogin("test@operator.jo", "operator")} style={btnStyle}>Login as Operator</button>
            <button onClick={() => forceLogin("test@admin.jo", "admin")} style={btnStyle}>Login as Admin</button>
          </div>
          <button
            onClick={() => { logout(); refreshState(); }}
            style={{ ...btnStyle, background: "var(--error-50)", color: "var(--error-700)", border: "1px solid var(--error-100)" }}
          >
            Clear Session & Logout
          </button>
        </div>
      </div>
    </AppShell>
  );
}
