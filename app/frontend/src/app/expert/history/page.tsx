"use client";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";
import { useApp } from "@/components/AppShell";
import { History, RefreshCw, MessageSquare, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { normalizeOwnerId } from "@/lib/user-context";
import { ProtectedRoute } from "@/components/ProtectedRoute";

type WorkflowCase = {
  case_id: string;
  query: string;
  status: string;
  priority: string;
  assigned_to?: string | null;
  created_at: string;
  resolved_at?: string | null;
  resolution_answer?: string | null;
  resolution_note?: string | null;
};

type CasesResponse = {
  cases?: WorkflowCase[];
};

export default function ExpertHistoryPage() {
  const { lang, isLoggedIn, userEmail } = useApp();
  const isAr = lang === "ar";
  const ownerId = useMemo(() => normalizeOwnerId(isLoggedIn, userEmail), [isLoggedIn, userEmail]);
  const [cases, setCases] = useState<WorkflowCase[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const endpoint = `http://localhost:9400/cases?status=closed&assignee=${encodeURIComponent(ownerId)}&page_size=100`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as CasesResponse;
      const ownCases = data.cases || [];
      if (ownCases.length > 0) {
        setCases(ownCases);
      } else {
        const fallback = await fetch("http://localhost:9400/cases?status=closed&page_size=100");
        if (!fallback.ok) throw new Error("failed");
        const fallbackData = (await fallback.json()) as CasesResponse;
        setCases(fallbackData.cases || []);
      }
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [ownerId]);

  return (
    <ProtectedRoute allowed={["operator", "admin"]} requireAuth>
    <AppShell title={isAr ? "القضايا المراجعة" : "Reviewed Cases"}>
      <div className="page-container" style={{ maxWidth: 1120 }}>
        <PageHeader
          title={isAr ? "سجل مراجعات الخبراء" : "Expert Review History"}
          subtitle={isAr ? "القرارات والردود التي قدمها فريق الخبراء سابقًا." : "Past decisions and responses provided by the expert team."}
          actions={
            <button onClick={fetchHistory} className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-stone-50 transition-colors">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              {isAr ? "تحديث" : "Refresh"}
            </button>
          }
        />

        <div className="hero-banner mb-6">
          <div className="hero-banner-content">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-amber-300/90 mb-2">
              {isAr ? "مركز جودة الخبراء" : "Expert Quality Desk"}
            </div>
            <div className="remaster-page-title text-white mb-2">
              {isAr ? "التذاكر المغلقة والردود المعتمدة" : "Closed Cases and Approved Responses"}
            </div>
            <div className="text-slate-200/80 text-sm max-w-3xl">
              {isAr ? "مرجع كامل لقرارات الخبراء السابقة للمراجعة والتدقيق وتحسين الاتساق التشغيلي." : "A complete archive of expert resolutions for auditing, quality control, and consistency."}
            </div>
          </div>
        </div>

        {cases.length === 0 ? (
          <EmptyState
            icon={History}
            title={isAr ? "لا يوجد سجل مراجعات" : "No expert decisions yet"}
            description={isAr ? "عند إغلاق التذاكر ستظهر الردود هنا." : "Resolved expert responses will appear here."}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {cases.map((item) => (
              <div key={item.case_id} className="surface-card-hover p-5">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status="resolved" />
                      <span className="text-xs text-slate-400 font-mono">#{item.case_id}</span>
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm mb-2">{item.query}</h3>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mb-3">
                      <CheckCircle2 size={12} />
                      {isAr ? "تمت المعالجة" : "Resolved"}: {new Date(item.resolved_at || item.created_at).toLocaleString(isAr ? "ar-JO" : "en-US")}
                    </div>
                    <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-3">
                      <div className="text-[11px] uppercase font-bold text-slate-400 mb-1">{isAr ? "الرد المعتمد" : "Approved response"}</div>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{item.resolution_answer || (isAr ? "لا يوجد نص رد" : "No response text")}</p>
                    </div>
                    {item.resolution_note && (
                      <div className="mt-2 text-xs text-slate-600 flex items-start gap-1.5">
                        <MessageSquare size={12} className="mt-0.5" />
                        {item.resolution_note}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
    </ProtectedRoute>
  );
}
