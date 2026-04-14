"use client";
import { AppShell } from "@/components/AppShell";
import { PageHeader, Button, StatCard } from "@/components/ui";
import { useApp } from "@/components/AppShell";
import { Settings, Save, AlertCircle, CheckCircle2, Server } from "lucide-react";
import { useEffect, useState } from "react";
import { governanceService, checkAllServices } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";

type PlatformSettings = {
  confidenceThreshold: number;
  escalationThreshold: number;
  maxResponseSeconds: number;
  enableAuditLogs: boolean;
  enableStrictGuardrails: boolean;
  allowPublicAccess: boolean;
};

const KEY = "shahem.admin.settings";

const DEFAULTS: PlatformSettings = {
  confidenceThreshold: 0.7,
  escalationThreshold: 0.45,
  maxResponseSeconds: 12,
  enableAuditLogs: true,
  enableStrictGuardrails: true,
  allowPublicAccess: true,
};

export default function AdminSettingsPage() {
  const { lang } = useApp();
  const isAr = lang === "ar";
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(KEY) || "null") as PlatformSettings | null;
      if (stored) setSettings(stored);
    } catch {
      setSettings(DEFAULTS);
    }

    checkAllServices().then(status => {
      setServiceStatus(status);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = () => {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  return (
    <ProtectedRoute allowed={["admin"]} requireAuth>
    <AppShell title={isAr ? "الإعدادات" : "Settings"}>
      <div className="page-container" style={{ maxWidth: 920 }}>
        <PageHeader
          title={isAr ? "إعدادات النظام" : "System Settings"}
          subtitle={isAr ? "تكوين معلمات النظام وحدود API وتفضيلات الأمان." : "Configure system parameters, API thresholds, and security preferences."}
          actions={<Button icon={Save} onClick={save}>{saved ? (isAr ? "✓ تم الحفظ" : "✓ Saved") : (isAr ? "حفظ الإعدادات" : "Save Settings")}</Button>}
        />

        {/* Service Health Status */}
        {!loading && (
          <div className="surface-card mb-6 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{isAr ? "حالة الخدمات" : "Service Health"}</h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{isAr ? "حالة جميع الخدمات المتاحة" : "Status of all available services"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'agent', label: isAr ? 'الوكيل' : 'Agent', icon: Server },
                { key: 'knowledge', label: isAr ? 'المعرفة' : 'Knowledge', icon: Server },
                { key: 'governance', label: isAr ? 'الحوكمة' : 'Governance', icon: Server },
                { key: 'workflow', label: isAr ? 'سير العمل' : 'Workflow', icon: Server },
              ].map(svc => (
                <div
                  key={svc.key}
                  className="p-3 rounded-lg border flex items-center gap-2"
                  style={{
                    background: serviceStatus[svc.key] ? "var(--success-50)" : "var(--error-50)",
                    borderColor: serviceStatus[svc.key] ? "var(--success-100)" : "var(--error-100)"
                  }}
                >
                  <div
                    className="p-1.5 rounded flex-shrink-0"
                    style={{
                      background: serviceStatus[svc.key] ? "var(--success-100)" : "var(--error-100)"
                    }}
                  >
                    {serviceStatus[svc.key] ? (
                      <CheckCircle2 size={14} style={{ color: "var(--success-600)" }} />
                    ) : (
                      <AlertCircle size={14} style={{ color: "var(--error-600)" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{svc.label}</div>
                    <div className="text-[10px]" style={{ color: serviceStatus[svc.key] ? "var(--success-600)" : "var(--error-600)" }}>
                      {serviceStatus[svc.key] ? (isAr ? "متصل" : "Online") : (isAr ? "غير متصل" : "Offline")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 24 }}>
          {/* API Thresholds Card */}
          <div className="surface-card" style={{ padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--primary-50)", border: "1px solid var(--primary-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Settings size={18} style={{ color: "var(--primary-700)" }} />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{isAr ? "حدود واجهة البرمجة" : "API Thresholds"}</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{isAr ? "ضبط حدود الأداء" : "Performance limits"}</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                    {isAr ? "حد الثقة الأدنى للإجابة" : "Minimum answer confidence"}
                  </label>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--primary-700)", minWidth: 56, textAlign: "right" }}>
                    {(settings.confidenceThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.confidenceThreshold}
                  onChange={(e) => setSettings((s) => ({ ...s, confidenceThreshold: Number(e.target.value) }))}
                  style={{ width: "100%", accentColor: "var(--primary-700)" }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                    {isAr ? "حد التصعيد التلقائي" : "Automatic escalation threshold"}
                  </label>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--warning-500)", minWidth: 56, textAlign: "right" }}>
                    {(settings.escalationThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.escalationThreshold}
                  onChange={(e) => setSettings((s) => ({ ...s, escalationThreshold: Number(e.target.value) }))}
                  style={{ width: "100%", accentColor: "var(--warning-500)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 10 }}>
                  {isAr ? "الحد الأقصى لزمن الاستجابة (ثانية)" : "Max response time (sec)"}
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={settings.maxResponseSeconds}
                  onChange={(e) => setSettings((s) => ({ ...s, maxResponseSeconds: Number(e.target.value) }))}
                  className="input"
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>

          {/* Security Preferences Card */}
          <div className="surface-card" style={{ padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--success-50)", border: "1px solid var(--success-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Settings size={18} style={{ color: "var(--success-700)" }} />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{isAr ? "تفضيلات الأمان" : "Security Preferences"}</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{isAr ? "إدارة الوصول والحماية" : "Access & protection"}</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { key: "enableAuditLogs", labelAr: "تفعيل سجلات التدقيق", labelEn: "Enable audit logs" },
                { key: "enableStrictGuardrails", labelAr: "تفعيل ضوابط صارمة", labelEn: "Enable strict guardrails" },
                { key: "allowPublicAccess", labelAr: "السماح بالوصول العام", labelEn: "Allow public access" },
              ].map((item) => {
                const key = item.key as keyof PlatformSettings;
                const checked = Boolean(settings[key]);
                return (
                  <label
                    key={item.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 0",
                      borderBottom: "1px solid var(--border-light)",
                      cursor: "pointer"
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{isAr ? item.labelAr : item.labelEn}</span>
                    <div style={{ position: "relative", width: 44, height: 24, borderRadius: "var(--radius-full)", background: checked ? "var(--success-500)" : "var(--gray-300)", transition: "background 0.2s", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
                        style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
                      />
                      <div style={{ position: "absolute", top: 2, left: checked ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "var(--white)", boxShadow: "var(--shadow-sm)", transition: "left 0.2s" }} />
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
    </ProtectedRoute>
  );
}
