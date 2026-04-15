import { useLang } from "./LangContext";
import { ArrowRight, Layers, Globe, Database, Cpu, BarChart3, Users } from "lucide-react";

export function NextPhasePage() {
  const { t } = useLang();

  const phases = [
    {
      title: t("V2 — Real Data Integration", "الإصدار 2 — تكامل البيانات الحقيقية"),
      icon: Database,
      color: "#4f46e5",
      items: [
        t("Live MoH / MoE / MoI API connections (not simulated)", "اتصالات مباشرة بـ MoH / MoE / MoI (غير محاكاة)"),
        t("Jordan E-Government portal data ingest for Citizen Voice", "استيعاب بيانات بوابة الحكومة الإلكترونية الأردنية لصوت المواطن"),
        t("MOPSD official KPI feeds for Policy Impact scoring", "تغذيات KPI الرسمية من وزارة التطوير لتقييم أثر السياسات"),
        t("Real-time friction telemetry from government service portals", "قياسات الاحتكاك في الوقت الحقيقي من بوابات الخدمة الحكومية"),
      ],
    },
    {
      title: t("V2 — Richer Dashboarding", "الإصدار 2 — لوحات تحكم أكثر ثراءً"),
      icon: BarChart3,
      color: "#0891b2",
      items: [
        t("Interactive Friction Score heatmap by ministry", "خريطة حرارة تفاعلية لدرجة الاحتكاك حسب الوزارة"),
        t("Policy Implementation velocity chart (time-series)", "مخطط سرعة تنفيذ السياسات (سلاسل زمنية)"),
        t("Org chart dynamic view with live agent status", "عرض ديناميكي للهيكل التنظيمي مع حالة العملاء الحية"),
        t("Cross-entity dependency graph (D3 / force-directed)", "رسم بياني لتبعيات الجهات (D3 / موجّه بالقوة)"),
      ],
    },
    {
      title: t("V3 — Stronger Arabic NLP", "الإصدار 3 — معالجة أعمق للغة العربية"),
      icon: Globe,
      color: "#059669",
      items: [
        t("Arabic-native sentiment analysis model (AraBERT / CAMeL)", "نموذج تحليل المشاعر الأصيل بالعربية (AraBERT / CAMeL)"),
        t("Dialectal Arabic (Levantine/Jordanian) complaint parsing", "تحليل الشكاوى باللهجة العربية (الشامية / الأردنية)"),
        t("Arabic-first Cabinet report generation with formal المسرد terminology", "توليد تقارير مجلس الوزراء بالعربية أولاً مع مصطلحات رسمية"),
        t("RTL-native PDF export for ministerial distribution", "تصدير PDF أصيل RTL للتوزيع الوزاري"),
      ],
    },
    {
      title: t("V3 — Expansion to More Ministers", "الإصدار 3 — التوسع لوزراء إضافيين"),
      icon: Users,
      color: "#7c3aed",
      items: [
        t("Multi-company Paperclip setup per minister", "إعداد Paperclip متعدد الشركات لكل وزير"),
        t("Shared cross-ministry coordination layer (CIB becomes cross-portfolio)", "طبقة تنسيق مشتركة عبر الوزارات (CIB تصبح عبر المحافظ)"),
        t("Prime Minister oversight dashboard aggregating all ministers", "لوحة تحكم إشرافية لرئيس الوزراء تجمع جميع الوزراء"),
        t("Role-based access: Minister / Deputy / Chief of Staff / Cabinet Secretary", "وصول مبني على الأدوار: وزير / نائب / رئيس ديوان / أمين مجلس"),
      ],
    },
    {
      title: t("V4 — Automation & Scalability", "الإصدار 4 — الأتمتة وقابلية التوسع"),
      icon: Cpu,
      color: "#d97706",
      items: [
        t("Automated Cabinet brief PDF generation and email delivery by Sunday 8AM", "توليد وتسليم إحاطة مجلس الوزراء تلقائياً بحلول الأحد 8 ص"),
        t("Agent-to-agent direct escalation without human trigger", "تصعيد مباشر من عميل إلى عميل بدون تدخل بشري"),
        t("Policy simulation: what-if analysis for proposed reforms", "محاكاة السياسات: تحليل ماذا لو للإصلاحات المقترحة"),
        t("Jordan Digital Government platform as source-of-truth integration", "منصة الحكومة الرقمية الأردنية كتكامل مصدر الحقيقة"),
      ],
    },
    {
      title: t("V4 — Transferability", "الإصدار 4 — قابلية النقل"),
      icon: Layers,
      color: "#0f766e",
      items: [
        t("Packaged template: deploy any ministry's digital twin in < 1 week", "قالب جاهز: نشر التوأم الرقمي لأي وزارة في أقل من أسبوع"),
        t("Open configuration schema — no hardcoded ministerial logic", "مخطط تكوين مفتوح — بدون منطق وزاري مُرمَّز"),
        t("Transferable to GCC and wider MENA public sector", "قابل للنقل إلى دول الخليج وقطاع عام الشرق الأوسط وشمال أفريقيا"),
        t("Published adapter for any LLM / orchestrator replacement", "محول منشور لأي استبدال LLM / محرك تنسيق"),
      ],
    },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">
          {t("Recommended Next Phase", "المرحلة التالية الموصى بها")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "What should be built after the hackathon — to turn this prototype into a production-grade ministerial twin.",
            "ما الذي يجب بناؤه بعد الهاكاثون — لتحويل هذا النموذج الأولي إلى توأم وزاري بمستوى الإنتاج.",
          )}
        </p>
      </div>

      <div className="space-y-4">
        {phases.map((phase) => {
          const Icon = phase.icon;
          return (
            <div key={phase.title} className="border border-border rounded-lg bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded flex items-center justify-center"
                  style={{ backgroundColor: phase.color + "20" }}
                >
                  <Icon className="w-4 h-4" style={{ color: phase.color }} />
                </div>
                <h2 className="text-sm font-semibold text-foreground">{phase.title}</h2>
              </div>
              <div className="space-y-1.5">
                {phase.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 rounded-lg border border-primary/20 bg-primary/5">
        <p className="text-sm text-foreground font-medium mb-1">
          {t("Bottom line", "الخلاصة")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t(
            "The hackathon prototype proves the architecture works. V2 requires real data pipelines (3 months). V3 requires Arabic NLP investment and multi-ministry expansion (6 months). V4 makes it a reusable, transferable platform for the wider Arab public sector (12 months).",
            "النموذج الأولي للهاكاثون يُثبت أن البنية تعمل. الإصدار 2 يتطلب مسارات بيانات حقيقية (3 أشهر). الإصدار 3 يتطلب استثماراً في معالجة اللغة العربية والتوسع متعدد الوزارات (6 أشهر). الإصدار 4 يجعله منصة قابلة للنقل للقطاع العام العربي الأوسع (12 شهراً).",
          )}
        </p>
      </div>
    </div>
  );
}
