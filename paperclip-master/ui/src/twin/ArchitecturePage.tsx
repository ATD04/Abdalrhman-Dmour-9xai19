import { useLang } from "./LangContext";
import { CAPABILITIES } from "./config";
import {
  Briefcase, Radar, Zap, MessageSquare, Building2,
  FileText, Network, ArrowDown, ArrowRight, Users,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  Briefcase, Radar, Zap, MessageSquare, Building2, FileText, Network,
};

export function ArchitecturePage() {
  const { t, isAr } = useLang();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">
          {t("System Architecture", "البنية المعمارية للنظام")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "Unified view of all 7 capabilities, agents, data flows, and integration layers.",
            "رؤية موحدة لجميع القدرات السبع والعملاء وتدفقات البيانات وطبقات التكامل.",
          )}
        </p>
      </div>

      {/* System overview */}
      <div className="grid grid-cols-1 gap-4 mb-8">
        {/* Top layer */}
        <div className="border border-border rounded-lg bg-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("Orchestration Layer", "طبقة التنسيق")}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-primary/30 bg-primary/5">
              <Briefcase className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {t("Chief of Staff Office", "مكتب رئيس الديوان")}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-teal-500/30 bg-teal-500/5">
              <Network className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-semibold text-foreground">
                {t("Cross-Entity Coordination Chief", "رئيس التنسيق عبر الجهات")}
              </span>
            </div>
          </div>
          <div className="flex justify-center mt-2">
            <ArrowDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        {/* 5 intelligence capabilities */}
        <div className="border border-border rounded-lg bg-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("Intelligence Capabilities", "قدرات الاستخبارات")}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {CAPABILITIES.filter((c) => c.key !== "cos" && c.key !== "coordination").map((cap) => {
              const Icon = iconMap[cap.icon] ?? FileText;
              return (
                <div
                  key={cap.key}
                  className="flex flex-col items-center text-center gap-1.5 p-3 rounded-md border border-border bg-muted/20"
                >
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: cap.color + "20" }}
                  >
                    <Icon className="w-4 h-4" style={{ color: cap.color }} />
                  </div>
                  <span className="text-xs font-medium text-foreground leading-tight">
                    {isAr ? cap.labelAr : cap.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    S{cap.sprint}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center mt-2">
            <ArrowDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        {/* Agent layer */}
        <div className="border border-border rounded-lg bg-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("Agent Teams (28 Agents Total)", "فرق العملاء (28 عميلاً)")}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {CAPABILITIES.map((cap) => (
              <div key={cap.key} className="text-center">
                <div
                  className="w-6 h-6 rounded mx-auto mb-1"
                  style={{ backgroundColor: cap.color }}
                />
                <div className="text-xs text-muted-foreground">
                  {cap.key === "coordination" ? "4" : "4"}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-2">
            <ArrowDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        {/* Infrastructure layer */}
        <div className="border border-border rounded-lg bg-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("Infrastructure", "البنية التحتية")}
          </div>
          <div className="flex gap-3 flex-wrap">
            {[
              { label: "Paperclip", sub: t("Orchestration Runtime", "بيئة التشغيل") },
              { label: "OpenCode", sub: t("LLM Execution", "تنفيذ النموذج") },
              { label: "Claude Sonnet 4.6", sub: t("Reasoning Model", "نموذج الاستدلال") },
              { label: "PostgreSQL", sub: t("State + Memory", "الحالة والذاكرة") },
              { label: "REST API", sub: t("/api endpoints", "نقاط النهاية") },
            ].map((item) => (
              <div key={item.label} className="px-3 py-2 rounded-md bg-muted/50 border border-border">
                <div className="text-xs font-semibold text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data flow */}
      <div className="border border-border rounded-lg bg-card p-5 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          {t("Weekly Intelligence Cycle", "دورة الاستخبارات الأسبوعية")}
        </h2>
        <div className="space-y-2">
          {[
            { day: t("Daily (6 AM)", "يومياً (6 ص)"), event: t("Chief of Staff → Daily Brief", "رئيس الديوان ← الإحاطة اليومية"), color: "#4f46e5" },
            { day: t("Mon + Wed (9 AM)", "الإثنين + الأربعاء (9 ص)"), event: t("Policy Tracker → Implementation Pulse", "متتبع السياسات ← نبض التنفيذ"), color: "#d97706" },
            { day: t("Wednesday (9 AM)", "الأربعاء (9 ص)"), event: t("Entity Linker → Dependency Scan", "رابط الجهات ← مسح التبعيات"), color: "#0f766e" },
            { day: t("Friday (8 AM)", "الجمعة (8 ص)"), event: t("Policy Report Writer → Weekly Impact Report", "كاتب تقرير السياسات ← التقرير الأسبوعي"), color: "#d97706" },
            { day: t("Friday (2 PM)", "الجمعة (2 م)"), event: t("Policy Impact Chief → Cross-Reference Analysis", "رئيس أثر السياسات ← تحليل الإسناد"), color: "#d97706" },
            { day: t("Friday (4 PM)", "الجمعة (4 م)"), event: t("Coord Chief → Escalation Review (ES > 15 threshold)", "رئيس التنسيق ← مراجعة التصعيد (ES > 15)"), color: "#0f766e" },
            { day: t("Sunday (7 AM)", "الأحد (7 ص)"), event: t("Coord Report Writer → Coordination Intelligence Brief (all 6 domains)", "كاتب تقرير التنسيق ← الإحاطة الاستخباراتية"), color: "#0f766e" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: item.color }} />
              <div>
                <span className="text-xs font-medium text-muted-foreground">{item.day}</span>
                <span className="text-xs text-muted-foreground"> — </span>
                <span className="text-xs text-foreground">{item.event}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration map */}
      <div className="border border-border rounded-lg bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          {t("Cross-Capability Integration Graph", "رسم بياني للتكامل عبر القدرات")}
        </h2>
        <div className="grid grid-cols-1 gap-2 text-xs">
          {[
            [t("Executive Radar", "الرادار التنفيذي"), "→", t("CIB (threat signals)", "إحاطة التنسيق (إشارات التهديد)")],
            [t("Service Friction", "احتكاك الخدمات"), "→", t("CIB (FS > 80 flags)", "إحاطة التنسيق (تحذيرات FS > 80)")],
            [t("Citizen Voice", "صوت المواطن"), "→", t("Policy Impact (SI drops)", "أثر السياسات (تراجع SI)")],
            [t("Citizen Voice", "صوت المواطن"), "→", t("CIB (sentiment crisis)", "إحاطة التنسيق (أزمة المشاعر)")],
            [t("Institutional Readiness", "الجاهزية المؤسسية"), "→", t("CIB (critical programs)", "إحاطة التنسيق (البرامج الحرجة)")],
            [t("Policy Impact", "أثر السياسات"), "→", t("CIB (stalled policies)", "إحاطة التنسيق (السياسات المتوقفة)")],
            [t("CIB (ES > 15)", "إحاطة التنسيق (ES > 15)"), "→", t("Chief of Staff → Cabinet Secretary", "رئيس الديوان → أمين مجلس الوزراء")],
          ].map(([from, arrow, to], i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium min-w-0 truncate">{from}</span>
              <ArrowRight className="w-3 h-3 shrink-0 text-muted-foreground" />
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary min-w-0 truncate">{to}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
