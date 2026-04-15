import { useLang } from "./LangContext";
import { CAPABILITIES } from "./config";
import {
  Briefcase, Radar, Zap, MessageSquare, Building2, FileText, Network,
  CheckCircle2, ArrowRight,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  Briefcase, Radar, Zap, MessageSquare, Building2, FileText, Network,
};

export function SummaryPage() {
  const { t, isAr } = useLang();

  const metrics = [
    { label: t("Capabilities Built", "القدرات المبنية"), value: "7" },
    { label: t("Agents Deployed", "العملاء المنشورون"), value: "28" },
    { label: t("Routines Scheduled", "الروتينات المجدولة"), value: "21" },
    { label: t("Issues Resolved", "المهام المحلولة"), value: "38+" },
    { label: t("Languages Supported", "اللغات المدعومة"), value: "2" },
    { label: t("Escalation Threshold", "عتبة التصعيد"), value: "ES > 15" },
  ];

  const sequence = [
    {
      n: 1, key: "cos",
      reason: t(
        "Built first as the executive operating layer — without execution rhythm, all downstream intelligence is meaningless.",
        "بُنيت أولاً كطبقة التشغيل التنفيذي — بدون إيقاع التنفيذ، كل الاستخبارات اللاحقة تفقد معناها.",
      ),
    },
    {
      n: 2, key: "radar",
      reason: t(
        "Second: the Minister needs macro-level visibility before drilling into service or citizen data.",
        "ثانياً: الوزير يحتاج رؤية كلية قبل الغوص في بيانات الخدمات أو المواطنين.",
      ),
    },
    {
      n: 3, key: "friction",
      reason: t(
        "Third: service friction is the most citizen-visible failure mode and feeds directly into citizen voice.",
        "ثالثاً: احتكاك الخدمات هو الفشل الأكثر ظهوراً للمواطن ويغذي صوت المواطن مباشرة.",
      ),
    },
    {
      n: 4, key: "voice",
      reason: t(
        "Fourth: citizen sentiment validates or contradicts service friction data — mutual reinforcement.",
        "رابعاً: مشاعر المواطن تتحقق أو تتناقض مع بيانات احتكاك الخدمات — تعزيز متبادل.",
      ),
    },
    {
      n: 5, key: "readiness",
      reason: t(
        "Fifth: before pushing policy, the Minister needs to know which entities can actually execute.",
        "خامساً: قبل دفع السياسات، يحتاج الوزير معرفة الجهات القادرة فعلاً على التنفيذ.",
      ),
    },
    {
      n: 6, key: "policy",
      reason: t(
        "Sixth: policy impact sits on top of readiness data — scoring implementation against outcome goals.",
        "سادساً: أثر السياسات يقع فوق بيانات الجاهزية — تقييم التنفيذ مقابل أهداف النتائج.",
      ),
    },
    {
      n: 7, key: "coordination",
      reason: t(
        "Seventh: synthesizes all 6 domains into one CIB — the integration layer that makes the system one.",
        "سابعاً: يجمع جميع المجالات الستة في إحاطة CIB واحدة — طبقة التكامل التي تجعل النظام واحداً.",
      ),
    },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">
          {t("Executive Summary", "الملخص التنفيذي")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "What was built, why in this order, and what makes it distinctive.",
            "ما الذي بُني، ولماذا بهذا الترتيب، وما الذي يجعله مميزاً.",
          )}
        </p>
      </div>

      {/* What was built */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
          {t("What Was Built", "ما الذي بُني")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t(
            "A full ministerial digital twin for the Minister of Public Sector Development — Jordan. Built across 7 sprints using Paperclip as the orchestration runtime and Claude Sonnet 4.6 as the reasoning model. Each capability is a live, agentic team with its own org structure, workflows, guardrails, and scheduled routines.",
            "توأم رقمي وزاري كامل لوزيرة تطوير القطاع العام — الأردن. بُني عبر 7 سباقات باستخدام Paperclip كبيئة التشغيل وClaude Sonnet 4.6 كنموذج الاستدلال. كل قدرة فريق عملاء حي بهيكل تنظيمي خاص به وسير عمل وحراس وروتينات مجدولة.",
          )}
        </p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {metrics.map((m) => (
            <div key={m.label} className="border border-border rounded-lg bg-card p-3 text-center">
              <div className="text-2xl font-bold text-foreground">{m.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2">
          {CAPABILITIES.map((cap) => {
            const Icon = iconMap[cap.icon] ?? FileText;
            return (
              <div key={cap.key} className="flex items-start gap-3 p-3 border border-border rounded-lg bg-card">
                <div
                  className="w-7 h-7 rounded flex items-center justify-center shrink-0"
                  style={{ backgroundColor: cap.color + "20" }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: cap.color }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{isAr ? cap.labelAr : cap.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{isAr ? cap.descriptionAr : cap.description}</p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              </div>
            );
          })}
        </div>
      </section>

      {/* Sequencing logic */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
          {t("Why This Sequence", "لماذا هذا الترتيب")}
        </h2>
        <div className="space-y-2">
          {sequence.map((item) => {
            const cap = CAPABILITIES.find((c) => c.key === item.key)!;
            const Icon = iconMap[cap.icon] ?? FileText;
            return (
              <div key={item.key} className="flex items-start gap-3 text-sm">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                  style={{ backgroundColor: cap.color }}
                >
                  {item.n}
                </div>
                <div>
                  <span className="font-medium text-foreground">{isAr ? cap.labelAr : cap.label}: </span>
                  <span className="text-muted-foreground">{item.reason}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* What makes it distinctive */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
          {t("What Makes It Distinctive", "ما الذي يجعله مميزاً")}
        </h2>
        <div className="space-y-2">
          {[
            t("Not 7 demos — one system. The Cross-Entity CIB synthesizes signals from all 6 domains weekly.", "ليست 7 عروض منفصلة — نظام واحد. إحاطة التنسيق تجمع إشارات من جميع المجالات الستة أسبوعياً."),
            t("Real escalation logic: Escalation Score = (JOD Exposure / 1M) × Ministries × Urgency. Auto-escalates ES > 15 to Cabinet Secretary.", "منطق تصعيد حقيقي: درجة التصعيد = (المبلغ المعرض / مليون دينار) × الوزارات × الإلحاح. التصعيد التلقائي ES > 15 إلى أمين مجلس الوزراء."),
            t("Bilingual output. All reports produced in Arabic + English — Cabinet-ready.", "مخرجات ثنائية اللغة. جميع التقارير بالعربية والإنجليزية — جاهزة لمجلس الوزراء."),
            t("Agentic org chart: each capability has a Chief (CEO), 3 specialist agents (researcher/general), and clear reporting lines.", "هيكل تنظيمي أجنتي: كل قدرة لها رئيس (CEO) و3 عملاء متخصصين وخطوط إعداد التقارير واضحة."),
            t("Operating rhythm: 21 scheduled routines across daily, bi-weekly, weekly, and Sunday cadences.", "إيقاع التشغيل: 21 روتيناً مجدولاً عبر إيقاعات يومية وثنائية أسبوعية وأسبوعية وأحد."),
          ].map((point, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-muted-foreground">{point}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
