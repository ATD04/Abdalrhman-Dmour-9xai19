"use client";
import { AppShell } from "@/components/AppShell";
import { PageHeader, StatCard } from "@/components/ui";
import { useApp } from "@/components/AppShell";
import { Building2, RefreshCw, BookOpen, MessageSquare, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

type WorkflowCase = {
  sector_primary: string;
};

type SourceInfo = {
  metadata?: { sector?: string };
};

type MinistryRow = {
  ministry: string;
  queries: number;
  documents: number;
  adoptionScore: number;
};

export default function ExecutiveMinistriesPage() {
  const { lang } = useApp();
  const isAr = lang === "ar";
  const [cases, setCases] = useState<WorkflowCase[]>([]);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([
        fetch("http://localhost:9400/cases?page_size=500"),
        fetch("http://localhost:9100/sources"),
      ]);

      if (cRes.ok) {
        const cData = await cRes.json();
        setCases(cData.cases || []);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setSources(sData.sources || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const rows = useMemo<MinistryRow[]>(() => {
    const queriesBy = new Map<string, number>();
    for (const c of cases) {
      const key = (c.sector_primary || "general").toLowerCase();
      queriesBy.set(key, (queriesBy.get(key) || 0) + 1);
    }

    const docsBy = new Map<string, number>();
    for (const s of sources) {
      const key = (s.metadata?.sector || "general").toLowerCase();
      docsBy.set(key, (docsBy.get(key) || 0) + 1);
    }

    const ministries = new Set([...queriesBy.keys(), ...docsBy.keys()]);
    return Array.from(ministries).map((ministry) => {
      const queries = queriesBy.get(ministry) || 0;
      const documents = docsBy.get(ministry) || 0;
      const adoptionScore = Math.min(100, Math.round((queries * 0.65) + (documents * 3.5)));
      return { ministry, queries, documents, adoptionScore };
    }).sort((a, b) => b.adoptionScore - a.adoptionScore);
  }, [cases, sources]);

  return (
    <ProtectedRoute allowed={["admin"]} requireAuth>
    <AppShell title={isAr ? "تبني الوزارات" : "Ministry Adoption"}>
      <div className="page-container">
        <PageHeader
          title={isAr ? "تقرير تبني الوزارات" : "Ministry Adoption Report"}
          subtitle={isAr ? "قياس استخدام كل وزارة لمنصة شهم وتأثيرها التشغيلي." : "Detailed insights into ministry utilization and operational impact."}
          actions={
            <button onClick={fetchData} className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-stone-50 transition-colors">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              {isAr ? "تحديث" : "Refresh"}
            </button>
          }
        />

        <div className="hero-banner mb-6">
          <div className="hero-banner-content">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-amber-300/90 mb-2">
              {isAr ? "أداء الوزارات" : "Ministry Performance"}
            </div>
            <div className="remaster-page-title text-white mb-2">
              {isAr ? "تحليل التبني حسب القطاع" : "Adoption Analysis by Sector"}
            </div>
            <div className="text-slate-200/80 text-sm max-w-3xl">
              {isAr ? "لوحة تنفيذية تجمع عدد الاستفسارات، حجم المحتوى، ومؤشر التبني لكل وزارة لدعم التخطيط والتحسين." : "An executive board that combines query volume, indexed content, and adoption score for each ministry."}
            </div>
          </div>
        </div>

        <div className="remaster-kpi-strip mb-6">
          <StatCard title={isAr ? "إجمالي الوزارات النشطة" : "Active Ministries"} value={rows.length} icon={Building2} iconColor="#123A63" />
          <StatCard title={isAr ? "إجمالي الاستفسارات" : "Total Queries"} value={cases.length.toLocaleString()} icon={MessageSquare} iconColor="#1E6F7A" />
          <StatCard title={isAr ? "إجمالي الوثائق المفهرسة" : "Indexed Documents"} value={sources.length.toLocaleString()} icon={BookOpen} iconColor="#B7791F" />
        </div>

        <div className="remaster-panel overflow-hidden">
          <div className="section-header px-4 pt-4">
            <div>
              <div className="section-title">{isAr ? "جدول المؤشرات القطاعية" : "Sector Indicators Table"}</div>
              <div className="section-subtitle">{isAr ? "مقارنة مباشرة بين الوزارات" : "Direct comparison across ministries"}</div>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-y text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">{isAr ? "الوزارة / القطاع" : "Ministry / Sector"}</th>
                <th className="px-4 py-3 text-left">{isAr ? "الاستفسارات" : "Queries"}</th>
                <th className="px-4 py-3 text-left">{isAr ? "الوثائق" : "Documents"}</th>
                <th className="px-4 py-3 text-left">{isAr ? "مؤشر التبني" : "Adoption Score"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ministry} className="border-b last:border-b-0 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.ministry}</td>
                  <td className="px-4 py-3 text-slate-700">{row.queries}</td>
                  <td className="px-4 py-3 text-slate-700">{row.documents}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#123A63]" style={{ width: `${row.adoptionScore}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1"><TrendingUp size={12} />{row.adoptionScore}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
    </ProtectedRoute>
  );
}
