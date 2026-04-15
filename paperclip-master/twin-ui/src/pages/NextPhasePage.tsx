import { useLang } from '../context/LangContext';

const PHASES = [
  {
    num: 'Phase 1',
    labelEn: 'Connect Real Data',
    labelAr: 'ربط البيانات الحقيقية',
    timeEn: 'Q3 2025',
    timeAr: 'الربع الثالث 2025',
    color: 'from-blue-600/20 to-blue-600/5 border-blue-500/30',
    accent: 'text-blue-400',
    dot: 'bg-blue-400',
    items: [
      { en: 'Link to Jordan e-Government real-time data APIs',              ar: 'الربط بواجهات بيانات الحكومة الإلكترونية الأردنية في الوقت الحقيقي' },
      { en: 'Connect citizen feedback platforms (social, surveys, portals)',ar: 'ربط منصات ملاحظات المواطنين (اجتماعي، استبيانات، بوابات)' },
      { en: 'Secure role-based access for ministry staff',                  ar: 'وصول آمن قائم على الأدوار لموظفي الوزارة' },
    ],
  },
  {
    num: 'Phase 2',
    labelEn: 'Expand Across Ministries',
    labelAr: 'التوسع عبر الوزارات',
    timeEn: 'Q4 2025',
    timeAr: 'الربع الرابع 2025',
    color: 'from-violet-600/20 to-violet-600/5 border-violet-500/30',
    accent: 'text-violet-400',
    dot: 'bg-violet-400',
    items: [
      { en: 'Deploy the twin model across 5 Jordanian ministries', ar: 'نشر نموذج التوأم عبر 5 وزارات أردنية' },
      { en: 'Cross-ministry intelligence feeds and shared briefings',ar: 'تغذيات استخباراتية بين الوزارات وإحاطات مشتركة' },
      { en: 'Cabinet-level consolidated dashboard',                ar: 'لوحة قيادة موحدة على مستوى مجلس الوزراء' },
    ],
  },
  {
    num: 'Phase 3',
    labelEn: 'National Governance Platform',
    labelAr: 'منصة الحوكمة الوطنية',
    timeEn: 'Q1–Q2 2026',
    timeAr: 'الربع الأول–الثاني 2026',
    color: 'from-amber-600/20 to-amber-600/5 border-amber-500/30',
    accent: 'text-amber-400',
    dot: 'bg-amber-400',
    items: [
      { en: 'Jordan National AI Governance Intelligence Platform',    ar: 'منصة الاستخبارات الوطنية للحوكمة بالذكاء الاصطناعي في الأردن' },
      { en: 'AI-generated annual national reform agenda',             ar: 'أجندة الإصلاح الوطنية السنوية المولدة بالذكاء الاصطناعي' },
      { en: 'Citizen participation portal — feedback becomes policy', ar: 'بوابة مشاركة المواطنين — تتحول الملاحظات إلى سياسات' },
      { en: 'Exportable model for other Arab Kingdom nations',        ar: 'نموذج قابل للتصدير للدول العربية الشقيقة' },
    ],
  },
];

export function NextPhasePage() {
  const { t } = useLang();

  return (
    <div className="min-h-full p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <p className="text-sm text-twin-accent font-semibold tracking-wide mb-1">
          {t('Strategic Roadmap', 'خارطة الطريق الاستراتيجية')}
        </p>
        <h1 className="text-3xl font-bold text-slate-100">
          {t('What Comes Next', 'ما الذي يأتي بعد ذلك')}
        </h1>
        <p className="text-slate-500 mt-2 text-base">
          {t(
            'From a working prototype to a national governance platform.',
            'من نموذج عمل إلى منصة حوكمة وطنية.',
          )}
        </p>
      </div>

      {/* Phase cards */}
      <div className="space-y-5 mb-10">
        {PHASES.map(phase => (
          <div key={phase.num} className={`rounded-2xl border bg-gradient-to-br p-6 ${phase.color}`}>
            <div className="flex items-center gap-3 mb-1">
              <span className={`text-xs font-bold uppercase tracking-widest ${phase.accent}`}>{phase.num}</span>
              <span className="text-slate-600 text-xs">·</span>
              <span className="text-xs text-slate-500">{t(phase.timeEn, phase.timeAr)}</span>
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-4">{t(phase.labelEn, phase.labelAr)}</h3>
            <ul className="space-y-2.5">
              {phase.items.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className={`w-1.5 h-1.5 rounded-full ${phase.dot} mt-1.5 shrink-0`} />
                  <span className="text-sm text-slate-300">{t(item.en, item.ar)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Vision */}
      <div className="rounded-2xl border border-twin-accent/25 bg-twin-accent/5 p-7 text-center">
        <p className="text-twin-accent font-bold text-lg mb-3">
          {t('Vision 2026', 'رؤية 2026')}
        </p>
        <p className="text-slate-300 text-base leading-relaxed max-w-xl mx-auto">
          {t(
            'Jordan becomes the first Arab nation to operate a fully AI-powered ministerial intelligence layer — where every decision is evidence-based, every citizen voice is heard, and every policy is tested before it scales.',
            'تصبح الأردن أول دولة عربية تُشغِّل طبقة استخبارات وزارية مدعومة بالكامل بالذكاء الاصطناعي — حيث يقوم كل قرار على أدلة، ويُسمع كل صوت مواطن، وتُختبر كل سياسة قبل توسيع نطاقها.',
          )}
        </p>
      </div>
    </div>
  );
}
