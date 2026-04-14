"use client";
import { AppShell } from "@/components/AppShell";
import { PageHeader, StatCard } from "@/components/ui";
import { useApp } from "@/components/AppShell";
import { governanceService, type MetricsResult, type TopicInsightsResult } from "@/lib/api";
import { BarChart3, RefreshCw, Activity, AlertTriangle, Target, TrendingUp, Sparkles, Lightbulb } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line } from "recharts";
import { ProtectedRoute } from "@/components/ProtectedRoute";

type ChartRow = { topic: string; count: number };
type TrendRow = { date: string; total: number };
type InsightSourceKind = "audit" | "history" | "none";

export default function ExecutiveAnalyticsPage() {
  const { lang } = useApp();
  const isAr = lang === "ar";
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [topicInsights, setTopicInsights] = useState<TopicInsightsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsData, topicData] = await Promise.all([
        governanceService.getMetrics(period),
        governanceService.getTopicInsights(period, 8),
      ]);
      setMetrics(metricsData);
      setTopicInsights(topicData);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const trendSelection = useMemo(
    () => pickInsights(topicInsights, (data) => data.trend_series.length > 0),
    [topicInsights],
  );

  const trendingSelection = useMemo(
    () => pickInsights(topicInsights, (data) => data.top_topics.length > 0),
    [topicInsights],
  );

  const recommendationSelection = useMemo(
    () => pickInsights(topicInsights, (data) => data.recommendations_executive.length > 0),
    [topicInsights],
  );

  const topicRows = useMemo<ChartRow[]>(() => {
    return (trendingSelection.data?.top_topics || []).map((item) => ({
      topic: isAr ? item.label_ar : item.label_en,
      count: item.count,
    }));
  }, [isAr, trendingSelection.data]);

  const trendRows = useMemo<TrendRow[]>(() => {
    const series = trendSelection.data?.trend_series || [];
    const totals = new Map<string, number>();
    for (const topic of series) {
      for (const point of topic.points) {
        totals.set(point.date, (totals.get(point.date) || 0) + point.count);
      }
    }
    return Array.from(totals.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, total]) => ({ date: date.slice(5), total }));
  }, [trendSelection.data]);

  const risingTopics = trendingSelection.data?.rising_topics || [];
  const executiveRecommendations = recommendationSelection.data?.recommendations_executive || [];
  const recommendationTopicMap = useMemo(
    () => new Map((recommendationSelection.data?.top_topics || []).map((item) => [item.topic_key, item])),
    [recommendationSelection.data],
  );

  return (
    <ProtectedRoute allowed={["admin"]} requireAuth>
    <AppShell title={isAr ? "التحليلات" : "Usage Analytics"}>
      <div className="page-container space-y-6" style={{ maxWidth: 1240 }}>
        <PageHeader
          title={isAr ? "تحليلات الاستخدام التنفيذي" : "Executive Usage Analytics"}
          subtitle={isAr ? "قياس التبني، الموضوعات الرائجة، ودقة الاستجابة عبر الوزارات." : "Track adoption, trending topics, and response accuracy across ministries."}
          actions={
            <div className="flex items-center gap-2">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as "7d" | "30d" | "90d")}
                className="px-2 py-1.5 rounded-md border text-sm bg-white"
              >
                <option value="7d">{isAr ? "7 أيام" : "7 Days"}</option>
                <option value="30d">{isAr ? "30 يوما" : "30 Days"}</option>
                <option value="90d">{isAr ? "90 يوما" : "90 Days"}</option>
              </select>
              <button onClick={fetchAnalytics} className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-stone-50 transition-colors">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                {isAr ? "تحديث" : "Refresh"}
              </button>
            </div>
          }
        />

        <div className="hero-banner">
          <div className="hero-banner-content">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-amber-300/90 mb-2">
              {isAr ? "لوحة ذكاء تنفيذي" : "Executive Intelligence Layer"}
            </div>
            <div className="remaster-page-title text-white mb-2">
              {isAr ? "اتجاهات الطلب حسب الموضوع" : "Topic Demand and Performance Trends"}
            </div>
            <div className="text-slate-200/80 text-sm max-w-3xl">
              {isAr ? "تحليل مباشر لمواضيع الأسئلة الأكثر طلبا، المواضيع الصاعدة، وتوصيات تنفيذية مبنية على الطلب الحقيقي." : "Live intelligence on high-demand topics, rising interests, and strategic recommendations grounded in real question demand."}
            </div>
          </div>
        </div>

        <div className="remaster-kpi-strip">
          <StatCard title={isAr ? "إجمالي الاستفسارات" : "Total Queries"} value={(metrics?.total_queries ?? 0).toLocaleString()} icon={Activity} iconColor="#123A63" />
          <StatCard title={isAr ? "دقة الاستجابة" : "AI Response Accuracy"} value={`${((metrics?.avg_confidence ?? 0) * 100).toFixed(1)}%`} icon={Target} iconColor="#0F766E" />
          <StatCard title={isAr ? "معدل التصعيد" : "Escalation Rate"} value={`${((metrics?.escalation_rate ?? 0) * 100).toFixed(1)}%`} icon={AlertTriangle} iconColor="#B42318" />
          <StatCard title={isAr ? "متوسط زمن الاستجابة" : "Avg Response Time"} value={`${(((metrics?.avg_latency_ms ?? 0) / 1000).toFixed(2))}s`} icon={BarChart3} iconColor="#B7791F" />
        </div>

        <div className="remaster-panel">
          <div className="section-header">
            <div>
              <div className="section-title">{isAr ? "الاهتمام عبر الوقت" : "Interest Over Time"}</div>
              <div className="section-subtitle">{getTrendSubtitle(isAr, trendSelection.source)}</div>
            </div>
          </div>
          <div className="remaster-panel-body">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#123A63" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="remaster-grid">
          <div className="remaster-span-8 remaster-panel">
            <div className="section-header">
              <div>
                <div className="section-title">{isAr ? "الموضوعات الرائجة" : "Trending Topics"}</div>
                <div className="section-subtitle">{getTrendingSubtitle(isAr, trendingSelection.source)}</div>
              </div>
            </div>
            <div className="remaster-panel-body">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topicRows}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="topic" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#123A63" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                <div className="rounded-xl border p-3">
                  <div className="text-sm font-semibold mb-2 inline-flex items-center gap-2"><TrendingUp size={14} />{isAr ? "Top Topics" : "Top Topics"}</div>
                  <div className="space-y-2">
                    {(trendingSelection.data?.top_topics || []).slice(0, 5).map((item, idx) => (
                      <div key={item.topic_key} className="flex items-center justify-between text-sm">
                        <span>{idx + 1}. {isAr ? item.label_ar : item.label_en}</span>
                        <span className="font-semibold">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="text-sm font-semibold mb-2 inline-flex items-center gap-2"><Sparkles size={14} />{isAr ? "المواضيع الصاعدة" : "Rising Topics"}</div>
                  <div className="space-y-2">
                    {risingTopics.slice(0, 5).map((item) => (
                      <div key={item.topic_key} className="flex items-center justify-between text-sm">
                        <span>{isAr ? item.label_ar : item.label_en}</span>
                        <span className="font-semibold text-emerald-700">
                          {item.breakout ? (isAr ? "اختراق" : "Breakout") : `+${item.delta}`}
                        </span>
                      </div>
                    ))}
                    {risingTopics.length === 0 && (
                      <div className="text-xs text-slate-500">{isAr ? "لا توجد مواضيع صاعدة كافية في الفترة الحالية" : "No strong rising topics in the current window"}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="remaster-span-4 remaster-panel">
            <div className="section-header">
              <div>
                <div className="section-title">{isAr ? "توصيات قيادية" : "Executive Recommendations"}</div>
                <div className="section-subtitle">{getRecommendationSubtitle(isAr, recommendationSelection.source)}</div>
              </div>
            </div>
            <div className="remaster-panel-body space-y-4">
              {executiveRecommendations.slice(0, 3).map((rec) => (
                <div key={`${rec.target}-${rec.topic_key}`} className="rounded-xl border p-3 bg-white">
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{rec.priority}</div>
                  <div className="text-sm font-semibold inline-flex items-start gap-2">
                    <Lightbulb size={14} className="mt-0.5" />
                    {isAr ? rec.title_ar : rec.title_en}
                  </div>
                  <div className="text-xs text-slate-600 mt-2">{isAr ? rec.rationale_ar : rec.rationale_en}</div>
                  {recommendationTopicMap.get(rec.topic_key)?.sample_queries?.[0] && (
                    <div className="text-xs text-slate-500 mt-2">
                      {isAr ? "إشارة من الاستفسارات:" : "Signal from queries:"} {recommendationTopicMap.get(rec.topic_key)?.sample_queries?.[0]}
                    </div>
                  )}
                  <div className="text-xs text-slate-700 mt-2 font-medium">{isAr ? "الحل المقترح:" : "Suggested Solution:"} {(rec.suggested_solution || "")} </div>
                </div>
              ))}
              {executiveRecommendations.length === 0 && (
                <div className="text-sm text-slate-500">{isAr ? "لا توجد توصيات كافية بعد. ابدأ بجمع المزيد من الاستفسارات." : "Not enough signals yet. Collect more query volume to generate strategic recommendations."}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
    </ProtectedRoute>
  );
}

function pickInsights(
  primary: TopicInsightsResult | null,
  hasData: (data: TopicInsightsResult) => boolean,
): { data: TopicInsightsResult | null; source: InsightSourceKind } {
  if (primary && hasData(primary)) {
    return { data: primary, source: "audit" };
  }
  return { data: primary, source: "none" };
}

function getTrendSubtitle(isAr: boolean, source: InsightSourceKind): string {
  if (source === "audit") {
    return isAr ? "إجمالي حجم الأسئلة اليومية حسب المواضيع المصنفة" : "Daily total question volume across classified topics";
  }
  return isAr ? "لا توجد بيانات كافية بعد من سجل التدقيق" : "Not enough audit data yet";
}

function getTrendingSubtitle(isAr: boolean, source: InsightSourceKind): string {
  if (source === "audit") {
    return isAr ? "حسب أسئلة المستخدمين المسجلة في سجل التدقيق" : "Based on user questions in governance audit logs";
  }
  return isAr ? "لا توجد بيانات كافية بعد من سجل التدقيق" : "Not enough audit data yet";
}

function getRecommendationSubtitle(isAr: boolean, source: InsightSourceKind): string {
  if (source === "audit") {
    return isAr ? "حلول مقترحة حسب المواضيع الأكثر طلبا" : "Suggested solutions based on most-demanded topics";
  }
  return isAr ? "لا توجد إشارات كافية بعد لتوليد توصيات قيادية" : "Not enough real signals yet to generate executive recommendations";
}
