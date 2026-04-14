"use client";
import { AppShell } from "@/components/AppShell";
import { StatCard, StatusBadge, PageHeader, Button, Alert, SkeletonCard, EmptyState } from "@/components/ui";
import { governanceService, checkAllServices, type MetricsResult, type AuditEntry, type TopicInsightsResult } from "@/lib/api";
import {
  Activity, AlertTriangle,
  Eye, ShieldCheck, BarChart3, Zap, RefreshCw, CheckCircle, XCircle, Sliders, Lightbulb
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const AR_RULE_TEXT_MAP: Array<{ includes: string; ar: string }> = [
  {
    includes: "auto-suggest approved faq snippets before full generation",
    ar: "اقتراح تلقائي لمقاطع أسئلة شائعة معتمدة قبل التوليد الكامل لهذا الموضوع.",
  },
  {
    includes: "enforce minimum citation count and ministry-source alignment checks",
    ar: "فرض حد أدنى لعدد الاستشهادات والتحقق من توافق المصدر مع الوزارة لهذا الموضوع.",
  },
  {
    includes: "adopt a topic-specific governance policy review cadence",
    ar: "اعتماد وتيرة مراجعة دورية لسياسات الحوكمة الخاصة بهذا الموضوع ضمن اجتماعات القيادة الشهرية.",
  },
];

const AR_SOLUTION_TEXT_MAP: Array<{ includes: string; ar: string }> = [
  {
    includes: "deploy a proactive faq + guided flow to reduce repeat queries and support load",
    ar: "تطبيق أسئلة شائعة استباقية مع مسار إرشادي لتقليل تكرار الاستفسارات وتخفيف عبء الدعم.",
  },
  {
    includes: "prioritize ingestion of official documents and create canonical faq entries",
    ar: "إعطاء أولوية لفهرسة الوثائق الرسمية وإنشاء إدخالات أسئلة شائعة مرجعية لهذا الموضوع.",
  },
  {
    includes: "initiate a cross-ministry taskforce and define a 60-day service-improvement roadmap",
    ar: "إطلاق فريق عمل مشترك بين الوزارات وتحديد خارطة طريق لمدة 60 يوماً لتحسين الخدمة.",
  },
  {
    includes: "approve an early policy communication package and targeted digital service updates",
    ar: "اعتماد حزمة تواصل سياساتي مبكرة وتحديثات رقمية موجهة للخدمات.",
  },
  {
    includes: "set kpi targets for turnaround, confidence, and escalation reduction",
    ar: "تحديد مؤشرات أداء مستهدفة لزمن الإنجاز ومستوى الثقة وخفض حالات التصعيد في هذا الموضوع.",
  },
];

function localizeRecommendationText(
  text: string | undefined,
  isAr: boolean,
  map: Array<{ includes: string; ar: string }>,
  explicitArabic?: string
): string {
  if (!text) return "";
  if (!isAr) return text;
  if (explicitArabic?.trim()) return explicitArabic;

  const normalized = text.toLowerCase();
  const mapped = map.find((entry) => normalized.includes(entry.includes));
  return mapped?.ar || text;
}

export default function AdminPage() {
  const { lang } = useApp();
  const isAr = lang === "ar";

  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [topicInsights, setTopicInsights] = useState<TopicInsightsResult | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [serviceStatus, setServiceStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Advanced filtering state
  const [filters, setFilters] = useState({
    userType: '',
    escalatedOnly: false,
    sector: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsData, topicData, auditData, statusData] = await Promise.all([
        governanceService.getMetrics('24h'),
        governanceService.getTopicInsights('30d', 8),
        governanceService.listAuditLogs({
          page_size: 15,
          user_type: filters.userType || undefined,
          sector: filters.sector || undefined,
          escalated: filters.escalatedOnly || undefined,
        }),
        checkAllServices()
      ]);

      setMetrics(metricsData);
      setTopicInsights(topicData);
      setAuditLogs(auditData.records || []);
      setServiceStatus(statusData);
    } catch (err) {
      console.error("Failed to fetch admin data", err);
      setError(isAr ? "فشل تحميل بيانات المشرف" : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, [filters, isAr]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const topicChartData = (topicInsights?.top_topics || []).slice(0, 6).map((topic) => ({
    name: isAr ? topic.label_ar : topic.label_en,
    value: topic.count,
  }));

  const adminRecommendations = topicInsights?.recommendations_admin || [];

  return (
    <ProtectedRoute allowed={["admin"]} requireAuth>
    <AppShell title={isAr ? "برج مراقبة المشرف" : "Admin Control Tower"}>
      <div className="page-container space-y-6" style={{ maxWidth: 1280 }}>
        <PageHeader 
          title={isAr ? "برج مراقبة المشرف" : "Admin Control Tower"} 
          subtitle={isAr ? "صحة النظام، ضوابط الحوكمة، إدارة المستخدمين، والإشراف العملياتي." : "Platform health, governance controls, user management, and operational oversight."} 
          actions={
            <button onClick={() => fetchAdminData()} className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors" style={{ cursor: "pointer" }}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              {isAr ? "تحديث" : "Refresh"}
            </button>
          }
        />

        {loading && !metrics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
        <>
        {/* Service Health Status */}
        <div className="surface-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{isAr ? "حالة الخدمات" : "Service Health"}</h3>
            <div className="flex items-center gap-2">
              {Object.values(serviceStatus).every(v => v) ? (
                <span className="badge badge-success flex items-center gap-1.5">
                  <CheckCircle size={12} /> {isAr ? "جميع الخدمات تعمل" : "All Services Operational"}
                </span>
              ) : (
                <span className="badge badge-warning flex items-center gap-1.5">
                  <AlertTriangle size={12} /> {isAr ? "بعض الخدمات متأثرة" : "Some Services Degraded"}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { key: 'agent', label: isAr ? 'خدمة الوكيل' : 'Agent Service', icon: Activity },
              { key: 'knowledge', label: isAr ? 'خدمة المعرفة' : 'Knowledge Service', icon: BarChart3 },
              { key: 'governance', label: isAr ? 'خدمة الحوكمة' : 'Governance Service', icon: ShieldCheck },
              { key: 'workflow', label: isAr ? 'خدمة سير العمل' : 'Workflow Service', icon: Zap },
            ].map(svc => {
              const Icon = svc.icon;
              return (
                <div key={svc.key} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: serviceStatus[svc.key] ? "var(--success-50)" : "var(--error-50)", border: `1px solid ${serviceStatus[svc.key] ? "var(--success-100)" : "var(--error-100)"}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: serviceStatus[svc.key] ? "var(--success-100)" : "var(--error-100)" }}>
                    <Icon size={14} style={{ color: serviceStatus[svc.key] ? "var(--success-500)" : "var(--error-500)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{svc.label}</div>
                    <div className="text-[10px] font-medium" style={{ color: serviceStatus[svc.key] ? "var(--success-500)" : "var(--error-500)" }}>
                      {serviceStatus[svc.key] ? (isAr ? "متصل" : "Online") : (isAr ? "غير متصل" : "Offline")}
                    </div>
                  </div>
                  {serviceStatus[svc.key] ? (
                    <CheckCircle size={16} style={{ color: "var(--success-500)" }} />
                  ) : (
                    <XCircle size={16} style={{ color: "var(--error-500)" }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>
        )}

        {/* System health row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title={isAr ? "إجمالي الاستفسارات" : "Total Queries"} value={metrics?.total_queries ?? 0} icon={Activity} iconColor="var(--primary-700)" />
          <StatCard title={isAr ? "معدل التصعيد" : "Escalation Rate"} value={`${((metrics?.escalation_rate ?? 0) * 100).toFixed(1)}%`} icon={AlertTriangle} iconColor="var(--error-700)" />
          <StatCard title={isAr ? "معدل رفض الضوابط" : "Guardrail Rejections"} value={`${((metrics?.guardrail_rejection_rate ?? 0) * 100).toFixed(1)}%`} icon={ShieldCheck} iconColor="var(--success-700)" />
          <StatCard title={isAr ? "متوسط الثقة" : "Avg Confidence"} value={`${((metrics?.avg_confidence ?? 0) * 100).toFixed(0)}%`} icon={BarChart3} iconColor="var(--teal-accent)" />
          <StatCard title={isAr ? "متوسط زمن الاستجابة" : "Avg Latency"} value={`${((metrics?.avg_latency_ms ?? 0) / 1000).toFixed(1)}s`} icon={Zap} iconColor="var(--warning-700)" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Audit log */}
          <div className="surface-card">
            <div className="section-header">
              <div>
                <div className="section-title">{isAr ? "سجل المراجعة المتقدم" : "Advanced Audit Log"}</div>
                <div className="section-subtitle">{isAr ? "آخر 15 عملية مع التصفية" : "Last 15 operations with filtering"}</div>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors"
              >
                <Sliders size={14} />
                {isAr ? "تصفية" : "Filter"}
              </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="p-4 mb-4 rounded-lg border flex flex-col gap-3" style={{ background: "var(--bg-subtle)" }}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
                      {isAr ? "نوع المستخدم" : "User Type"}
                    </label>
                    <select
                      value={filters.userType}
                      onChange={(e) => setFilters(f => ({ ...f, userType: e.target.value }))}
                      className="input w-full text-sm"
                    >
                      <option value="">{isAr ? "الكل" : "All"}</option>
                      <option value="citizen">{isAr ? "مواطن" : "Citizen"}</option>
                      <option value="employee">{isAr ? "موظف" : "Employee"}</option>
                      <option value="admin">{isAr ? "مشرف" : "Admin"}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
                      {isAr ? "القطاع" : "Sector"}
                    </label>
                    <select
                      value={filters.sector}
                      onChange={(e) => setFilters(f => ({ ...f, sector: e.target.value }))}
                      className="input w-full text-sm"
                    >
                      <option value="">{isAr ? "الكل" : "All"}</option>
                      <option value="justice">{isAr ? "العدل" : "Justice"}</option>
                      <option value="finance">{isAr ? "المالية" : "Finance"}</option>
                      <option value="health">{isAr ? "الصحة" : "Health"}</option>
                      <option value="labor">{isAr ? "العمل" : "Labor"}</option>
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.escalatedOnly}
                    onChange={(e) => setFilters(f => ({ ...f, escalatedOnly: e.target.checked }))}
                  />
                  <span style={{ color: "var(--text-secondary)" }}>{isAr ? "المصعّدة فقط" : "Escalated only"}</span>
                </label>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="enhanced-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: isAr ? "right" : "left" }}>{isAr ? "الوقت" : "Time"}</th>
                    <th style={{ textAlign: isAr ? "right" : "left" }}>{isAr ? "الاستفسار" : "Query"}</th>
                    <th style={{ textAlign: isAr ? "right" : "left" }}>{isAr ? "المستخدم" : "User"}</th>
                    <th style={{ textAlign: isAr ? "right" : "left" }}>{isAr ? "الثقة" : "Confidence"}</th>
                    <th style={{ textAlign: isAr ? "right" : "left" }}>{isAr ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan={5}><EmptyState icon={Activity} title={isAr ? "لا توجد سجلات" : "No audit records"} description={isAr ? "ستظهر السجلات هنا عند توفر بيانات جديدة." : "Audit records will appear here as new data comes in."} /></td></tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{ fontFamily: "monospace", color: "var(--text-muted)", whiteSpace: "nowrap", fontSize: 12 }}>
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ fontWeight: 500, color: "var(--text-primary)", maxWidth: 200 }} className="truncate">{log.query}</td>
                        <td style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
                          <span className="px-2 py-1 rounded-full text-xs font-medium" style={{
                            background: log.user_type === 'admin' ? 'var(--error-50)' : log.user_type === 'employee' ? 'var(--primary-50)' : 'var(--gray-100)',
                            color: log.user_type === 'admin' ? 'var(--error-700)' : log.user_type === 'employee' ? 'var(--primary-700)' : 'var(--text-tertiary)'
                          }}>
                            {log.user_type}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
                          {log.confidence ? `${(log.confidence * 100).toFixed(0)}%` : '—'}
                        </td>
                        <td>
                          <StatusBadge status={log.escalated ? "critical" : (log.input_passed && log.output_passed ? "resolved" : "warning")} size="sm" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="surface-card">
            <div className="section-header">
              <div>
                <div className="section-title">{isAr ? "العمليات الحديثة" : "Recent Activity"}</div>
                <div className="section-subtitle">{isAr ? "آخر 15 عملية" : "Last 15 operations"}</div>
              </div>
              <Button variant="ghost" size="sm" icon={Eye}>{isAr ? "عرض الكل" : "View All"}</Button>
            </div>
            <div className="space-y-2 p-2">
              {auditLogs.slice(0, 8).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg transition-colors border-l-2"
                  style={{
                    borderLeftColor: log.escalated ? 'var(--error-500)' : log.input_passed && log.output_passed ? 'var(--success-500)' : 'var(--warning-500)'
                  }}
                >
                  <div
                    className="mt-1 p-2 rounded-lg flex-shrink-0"
                    style={{
                      background: log.escalated ? 'var(--error-50)' : log.input_passed && log.output_passed ? 'var(--success-50)' : 'var(--warning-50)'
                    }}
                  >
                    {log.escalated ? (
                      <AlertTriangle size={14} style={{ color: 'var(--error-500)' }} />
                    ) : log.input_passed && log.output_passed ? (
                      <CheckCircle size={14} style={{ color: 'var(--success-500)' }} />
                    ) : (
                      <Activity size={14} style={{ color: 'var(--warning-500)' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }} title={log.query}>
                      {log.query.substring(0, 50)}{log.query.length > 50 ? '...' : ''}
                    </div>
                    <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{
                        background: log.user_type === 'admin' ? 'var(--error-50)' : log.user_type === 'employee' ? 'var(--primary-50)' : 'var(--gray-100)',
                        color: log.user_type === 'admin' ? 'var(--error-700)' : log.user_type === 'employee' ? 'var(--primary-700)' : 'var(--text-tertiary)'
                      }}>
                        {log.user_type}
                      </span>
                      <span>
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="surface-card p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{isAr ? "توزيع الطلب حسب المواضيع" : "Query Distribution by Topic"}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{isAr ? "آخر 30 يوما" : "Last 30 days"}</div>
            </div>
            <span className="badge badge-success">Live Data</span>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topicChartData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500, fill: 'var(--text-tertiary)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500, fill: 'var(--text-tertiary)' }} />
                <Tooltip cursor={{ fill: 'var(--bg-subtle)' }} contentStyle={{ borderRadius: '10px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-lg)' }} />
                <Bar dataKey="value" fill="var(--primary-700)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 border-t pt-4">
            <div className="font-bold text-sm mb-3" style={{ color: "var(--text-primary)" }}>{isAr ? "توصيات تشغيلية للمشرف" : "Admin Topic Recommendations"}</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {adminRecommendations.slice(0, 4).map((rec) => (
                <div key={`admin-${rec.topic_key}`} className="rounded-xl border p-3" style={{ background: "var(--bg-subtle)" }}>
                  <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>{rec.priority}</div>
                  <div className="text-sm font-semibold flex items-start gap-2" style={{ color: "var(--text-primary)" }}>
                    <Lightbulb size={14} className="mt-0.5" />
                    {isAr ? rec.title_ar : rec.title_en}
                  </div>
                  <div className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>{isAr ? rec.rationale_ar : rec.rationale_en}</div>
                  <div className="text-xs mt-2 font-medium" style={{ color: "var(--text-primary)" }}>
                    {isAr ? "قاعدة مقترحة:" : "Suggested Rule:"} {localizeRecommendationText(rec.suggested_rule, isAr, AR_RULE_TEXT_MAP, rec.suggested_rule_ar)}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                    {isAr ? "حل مقترح:" : "Suggested Solution:"} {localizeRecommendationText(rec.suggested_solution, isAr, AR_SOLUTION_TEXT_MAP, rec.suggested_solution_ar)}
                  </div>
                </div>
              ))}
              {adminRecommendations.length === 0 && (
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {isAr ? "لا توجد توصيات كافية بعد. سيتم توليدها مع زيادة بيانات الأسئلة." : "Not enough topic signals yet. Recommendations will appear as more query data is collected."}
                </div>
              )}
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </AppShell>
    </ProtectedRoute>
  );
}
