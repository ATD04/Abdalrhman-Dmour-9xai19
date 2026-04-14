"use client";
import { AppShell } from "@/components/AppShell";
import { StatCard, MinistryTag, PageHeader, SkeletonCard, Alert } from "@/components/ui";
import { governanceService, knowledgeService, type MetricsResult, type TopicInsightsResult } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, TrendingUp, Users, AlertTriangle, Target, Activity, RefreshCw, FileText, Database, Download, X, Filter } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line
} from "recharts";
import { useState, useEffect } from "react";
import { useApp } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";

type TimePeriod = '24h' | '7d' | '30d' | 'custom';

interface SectorDetailModalProps {
  isOpen: boolean;
  sector: string | null;
  data: Record<string, number> | null;
  onClose: () => void;
  isAr: boolean;
}

function SectorDetailModal({ isOpen, sector, data, onClose, isAr }: SectorDetailModalProps) {
  if (!isOpen || !sector || !data) return null;

  const sectorQueries = data[sector] || 0;
  const totalQueries = Object.values(data).reduce((a, b) => a + b, 0);
  const percentage = totalQueries > 0 ? ((sectorQueries / totalQueries) * 100).toFixed(1) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center p-4 z-50"
        style={{ background: "color-mix(in srgb, var(--text-primary) 50%, transparent)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="rounded-2xl max-w-md w-full max-h-96 overflow-y-auto"
          style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1))" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 border-b p-5 flex items-center justify-between" style={{ background: "var(--bg-surface)" }}>
            <h3 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>
              {isAr ? "تفاصيل القطاع" : "Sector Details"}
            </h3>
            <button onClick={onClose} className="p-1 rounded-lg transition" style={{ background: "transparent" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-accent)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-6">
            <div>
              <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                {isAr ? "اسم القطاع" : "Sector Name"}
              </h4>
              <p className="text-2xl font-bold capitalize" style={{ color: "var(--primary-700)" }}>
                {sector.replace(/_/g, " ")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border" style={{ background: "var(--primary-50)", borderColor: "var(--primary-100)" }}>
                <div className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                  {isAr ? "الاستفسارات" : "Queries"}
                </div>
                <div className="text-2xl font-bold" style={{ color: "var(--primary-700)" }}>
                  {sectorQueries.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-lg border" style={{ background: "var(--success-50)", borderColor: "var(--success-100)" }}>
                <div className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                  {isAr ? "النسبة" : "Share"}
                </div>
                <div className="text-2xl font-bold" style={{ color: "var(--success-700)" }}>
                  {percentage}%
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                {isAr ? "النسبة من الإجمالي" : "Portion of Total"}
              </div>
              <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: "var(--bg-accent)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-full"
                  style={{ background: "linear-gradient(90deg, var(--primary-600), var(--primary-700))" }}
                />
              </div>
            </div>

            <div className="pt-3 border-t">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? `هذا القطاع مسؤول عن ${percentage}% من إجمالي استفسارات المنصة`
                  : `This sector accounts for ${percentage}% of platform's total queries`}
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function ExecutivePage() {
  const { lang } = useApp();
  const isAr = lang === "ar";

  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [topicInsights, setTopicInsights] = useState<TopicInsightsResult | null>(null);
  const [sourceCount, setSourceCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('7d');
  const [sectorModalOpen, setSectorModalOpen] = useState(false);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  const fetchData = async (period: TimePeriod = '7d') => {
    setLoading(true);
    setError(null);
    try {
      const topicInsightsPeriod: "7d" | "30d" | "90d" =
        period === "30d" ? "30d" : period === "7d" ? "7d" : "7d";

      const [metricsRes, sourcesRes, topicRes] = await Promise.all([
        governanceService.getMetrics(period),
        knowledgeService.listSources(),
        governanceService.getTopicInsights(topicInsightsPeriod, 6),
      ]);
      setMetrics(metricsRes);
      setSourceCount(sourcesRes.sources?.length || 0);
      setTopicInsights(topicRes);
    } catch (err) {
      console.error("Failed to fetch executive data:", err);
      setError(isAr ? "فشل تحميل البيانات" : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(timePeriod);
  }, [timePeriod]);

  const exportToCSV = () => {
    if (!metrics) return;

    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Queries', metrics.total_queries],
      ['Average Confidence', `${(metrics.avg_confidence * 100).toFixed(1)}%`],
      ['Escalation Rate', `${(metrics.escalation_rate * 100).toFixed(1)}%`],
      ['Avg Latency (ms)', metrics.avg_latency_ms],
      ['P95 Latency (ms)', metrics.p95_latency_ms],
      ['Guardrail Rejection Rate', `${(metrics.guardrail_rejection_rate * 100).toFixed(1)}%`],
      ['Period', metrics.period],
    ];

    if (metrics.sector_distribution) {
      rows.push(['', '']);
      rows.push(['Sector Distribution', '']);
      Object.entries(metrics.sector_distribution).forEach(([sector, count]) => {
        rows.push([sector, count.toString()]);
      });
    }

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `executive-metrics-${timePeriod}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Compute derived data
  const confidenceLevel = metrics?.avg_confidence ? metrics.avg_confidence * 100 : 0;
  const escalationPct = metrics?.escalation_rate ? metrics.escalation_rate * 100 : 0;
  const avgLatencySec = metrics?.avg_latency_ms ? (metrics.avg_latency_ms / 1000).toFixed(1) : "0";

  const executiveRecommendations = topicInsights?.recommendations_executive || [];

  // Generate sector data from metrics
  const sectorData = metrics?.sector_distribution
    ? Object.entries(metrics.sector_distribution)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 7)
    : [];

  return (
    <ProtectedRoute allowed={["admin"]} requireAuth>
    <AppShell title={isAr ? "لوحة التحكم التنفيذية" : "Executive Dashboard"}>
      <div className="page-container" style={{ maxWidth: 1280 }}>
        {/* Header with banner and controls */}
        <div className="hero-banner" style={{ marginBottom: 24 }}>
          <div className="hero-banner-content" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, flexDirection: isAr ? "row-reverse" : "row" }}>
            <div style={{ textAlign: isAr ? "right" : "left" }}>
              <div style={{ fontSize: 11, color: "var(--accent-gold)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{isAr ? "موجز الاستخبارات التنفيذي" : "Executive Intelligence Brief"}</div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--white)", letterSpacing: "-0.02em", marginBottom: 6 }}>{isAr ? "نظرة عامة على أداء المنصة" : "Platform Performance Overview"}</h1>
              <p style={{ fontSize: 14, color: "color-mix(in srgb, var(--gray-300) 65%, transparent)" }}>{isAr ? `في الـ ${timePeriod} الماضية · منصة استخبارات السياسات الوطنية الأردنية` : `Last ${timePeriod} · Jordan National Policy Intelligence Platform`}</p>
            </div>
            <div style={{ display: "flex", gap: 12, flexDirection: isAr ? "row-reverse" : "row", alignItems: "center", flexWrap: "wrap" }}>
              {/* Time Period Selector */}
              <div style={{ display: "flex", gap: 8, background: "color-mix(in srgb, var(--text-inverse) 8%, transparent)", padding: 6, borderRadius: 10, border: "1px solid color-mix(in srgb, var(--text-inverse) 15%, transparent)" }}>
                {(['24h', '7d', '30d'] as TimePeriod[]).map(period => (
                  <button
                    key={period}
                    onClick={() => setTimePeriod(period)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: timePeriod === period ? '1px solid color-mix(in srgb, var(--text-inverse) 30%, transparent)' : '1px solid transparent',
                      background: timePeriod === period ? 'color-mix(in srgb, var(--text-inverse) 15%, transparent)' : 'transparent',
                      color: 'var(--white)',
                      fontSize: 12,
                      fontWeight: timePeriod === period ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {period}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, flexDirection: isAr ? "row-reverse" : "row", alignItems: "center" }}>
                <button
                  onClick={() => fetchData(timePeriod)}
                  className="btn btn-sm"
                  style={{ background: "color-mix(in srgb, var(--text-inverse) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--text-inverse) 15%, transparent)", color: "var(--white)" }}
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  {isAr ? "تحديث" : "Refresh"}
                </button>

                <button
                  onClick={exportToCSV}
                  className="btn btn-sm"
                  style={{ background: "color-mix(in srgb, var(--accent-gold) 20%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-gold) 30%, transparent)", color: "var(--accent-gold)" }}
                >
                  <Download size={14} />
                  {isAr ? "تصدير CSV" : "Export CSV"}
                </button>
              </div>

              <div style={{ textAlign: isAr ? "left" : "right", padding: "12px 16px", background: "color-mix(in srgb, var(--text-inverse) 5%, transparent)", borderRadius: 12, border: "1px solid color-mix(in srgb, var(--text-inverse) 10%, transparent)" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--accent-gold)", letterSpacing: "-0.02em" }}>{confidenceLevel.toFixed(0)}%</div>
                <div style={{ fontSize: 11, color: "color-mix(in srgb, var(--gray-400) 70%, transparent)", marginTop: 2 }}>{isAr ? "جودة الاستجابة" : "Response Quality"}</div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="error" className="mb-6">
            {error}
          </Alert>
        )}

        {/* KPI row */}
        {loading && !metrics ? (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
            <StatCard
              title={isAr ? "إجمالي الاستفسارات" : "Total Queries"}
              value={metrics?.total_queries?.toLocaleString() || "0"}
              icon={Activity}
              iconColor="var(--primary-700)"
            />
            <StatCard
              title={isAr ? "الوثائق المفهرسة" : "Indexed Documents"}
              value={sourceCount.toLocaleString()}
              icon={FileText}
              iconColor="var(--teal-accent)"
            />
            <StatCard
              title={isAr ? "معدل التصعيد" : "Escalation Rate"}
              value={`${escalationPct.toFixed(1)}%`}
              icon={AlertTriangle}
              iconColor="var(--error-700)"
            />
            <StatCard
              title={isAr ? "متوسط زمن الاستجابة" : "Avg. Response Time"}
              value={isAr ? `${avgLatencySec} ثانية` : `${avgLatencySec}s`}
              icon={Target}
              iconColor="var(--warning-700)"
            />
          </div>
        )}

        {/* Charts row 1 */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
          {/* Sector distribution */}
          <div className="surface-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 4, textAlign: isAr ? "right" : "left", display: "flex", alignItems: "center", gap: 8 }}>
              {isAr ? "توزيع الاستفسارات حسب القطاع" : "Query Distribution by Sector"}
              <span className="badge badge-info" style={{ fontSize: 11 }}>interactive</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, textAlign: isAr ? "right" : "left" }}>{isAr ? "اضغط على أي قطاع للمزيد من التفاصيل" : "Click any sector for details"}</div>
            {sectorData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
                {isAr ? "لا توجد بيانات" : "No data available"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sectorData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500, fill: 'var(--text-muted)' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500, fill: 'var(--text-muted)' }} orientation={isAr ? "right" : "left"} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                  <Bar
                    dataKey="count"
                    fill="var(--primary-700)"
                    radius={[4, 4, 0, 0]}
                    name={isAr ? "الاستفسارات" : "Queries"}
                    onClick={(data: any) => {
                      if (data.name) {
                        setSelectedSector(data.name);
                        setSectorModalOpen(true);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Quality metrics from backend */}
          <div className="surface-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 4, textAlign: isAr ? "right" : "left" }}>{isAr ? "مؤشرات جودة الاستجابة" : "Response Quality Signals"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, textAlign: isAr ? "right" : "left" }}>{isAr ? "قيم مباشرة من بيانات الحوكمة" : "Direct values from governance telemetry"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                {
                  label: isAr ? "متوسط الثقة" : "Average Confidence",
                  value: `${((metrics?.avg_confidence || 0) * 100).toFixed(1)}%`,
                  pct: Math.max(0, Math.min(100, (metrics?.avg_confidence || 0) * 100)),
                  color: "#0F766E",
                },
                {
                  label: isAr ? "معدل التصعيد" : "Escalation Rate",
                  value: `${((metrics?.escalation_rate || 0) * 100).toFixed(1)}%`,
                  pct: Math.max(0, Math.min(100, (metrics?.escalation_rate || 0) * 100)),
                  color: "#B7791F",
                },
                {
                  label: isAr ? "معدل رفض الضوابط" : "Guardrail Rejection Rate",
                  value: `${((metrics?.guardrail_rejection_rate || 0) * 100).toFixed(1)}%`,
                  pct: Math.max(0, Math.min(100, (metrics?.guardrail_rejection_rate || 0) * 100)),
                  color: "#B42318",
                },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexDirection: isAr ? "row-reverse" : "row" }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.value}</span>
                  </div>
                  <div style={{ height: 6, background: "var(--stone-soft)", borderRadius: 4, overflow: "hidden" }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${item.pct}%` }} transition={{ duration: 0.7 }} style={{ height: "100%", background: item.color, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Metrics Details */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          {/* Agent distribution */}
          <div className="surface-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 4, textAlign: isAr ? "right" : "left" }}>{isAr ? "توزيع الوكلاء" : "Agent Distribution"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, textAlign: isAr ? "right" : "left" }}>{isAr ? "الاستفسارات المُعالجة حسب الوكيل المتخصص" : "Queries processed by specialist agent"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {metrics?.agent_distribution && Object.keys(metrics.agent_distribution).length > 0 ? (
                Object.entries(metrics.agent_distribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([agent, count]) => {
                    const total = Object.values(metrics.agent_distribution!).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const color = agent.includes("legal") ? "#0F766E" : agent.includes("policy") ? "#B7791F" : "#123A63";
                    return (
                      <div key={agent}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, flexDirection: isAr ? "row-reverse" : "row" }}>
                          <span style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "capitalize" }}>{agent.replace(/_/g, " ")}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color }}>{pct}%</span>
                        </div>
                        <div style={{ height: 5, background: "var(--stone-soft)", borderRadius: 3, overflow: "hidden" }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} style={{ height: "100%", background: color, borderRadius: 3, float: isAr ? "right" : "left" }} />
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  {isAr ? "لا توجد بيانات" : "No agent data available"}
                </div>
              )}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="surface-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 4, textAlign: isAr ? "right" : "left" }}>{isAr ? "مؤشرات الأداء الرئيسية" : "Key Performance Indicators"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, textAlign: isAr ? "right" : "left" }}>{isAr ? "ملخص الأداء للأسبوع الماضي" : "Performance summary for last 7 days"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: isAr ? "إجمالي الاستفسارات" : "Total Queries", value: metrics?.total_queries || 0, color: "#123A63" },
                { label: isAr ? "متوسط الثقة" : "Average Confidence", value: `${confidenceLevel.toFixed(1)}%`, color: "#0F766E" },
                { label: isAr ? "P95 زمن الاستجابة" : "P95 Latency", value: `${((metrics?.p95_latency_ms || 0) / 1000).toFixed(1)}s`, color: "#B7791F" },
                { label: isAr ? "معدل رفض الضوابط" : "Guardrail Rejection Rate", value: `${((metrics?.guardrail_rejection_rate || 0) * 100).toFixed(1)}%`, color: "#B42318" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{item.label}</span>
                  <span style={{ fontWeight: 800, fontSize: 14, color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Knowledge gap signals */}
        <div className="surface-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, flexDirection: isAr ? "row-reverse" : "row" }}>
            <div style={{ textAlign: isAr ? "right" : "left" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{isAr ? "توصيات النظام" : "System Recommendations"}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{isAr ? "إجراءات مقترحة بناءً على بيانات الأداء" : "Suggested actions based on performance data"}</div>
            </div>
            {escalationPct > 5 && (
              <span className="badge badge-warning">{isAr ? "يوصى باتخاذ إجراء" : "Action Recommended"}</span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {executiveRecommendations.slice(0, 4).map((rec) => (
              <div key={`${rec.target}-${rec.topic_key}`} className="recommendation-card" style={{ textAlign: isAr ? "right" : "left" }}>
                <div className="recommendation-card-header" style={{ flexDirection: isAr ? "row-reverse" : "row" }}>
                  <span className="recommendation-card-title">{isAr ? rec.title_ar : rec.title_en}</span>
                  <span className="recommendation-card-badge" style={{ color: "var(--warning-500)", background: "var(--warning-100)" }}>{rec.priority}</span>
                </div>
                <div className="recommendation-card-description">
                  {isAr ? rec.rationale_ar : rec.rationale_en}
                </div>
                <div style={{ fontSize: 12, marginTop: 8, color: "var(--text-secondary)" }}>
                  {isAr ? "حل مقترح:" : "Suggested solution:"} {isAr ? (rec.suggested_solution_ar || rec.suggested_solution || "—") : (rec.suggested_solution || "—")}
                </div>
              </div>
            ))}
            {executiveRecommendations.length === 0 && (
              <div className="recommendation-card" style={{ textAlign: isAr ? "right" : "left" }}>
                <div className="recommendation-card-description">
                  {isAr ? "لا توجد توصيات تنفيذية كافية في بيانات الحوكمة الحالية." : "No executive recommendations available from current governance data."}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SectorDetailModal
        isOpen={sectorModalOpen}
        sector={selectedSector}
        data={metrics?.sector_distribution || null}
        onClose={() => {
          setSectorModalOpen(false);
          setSelectedSector(null);
        }}
        isAr={isAr}
      />
    </AppShell>
    </ProtectedRoute>
  );
}
