import { useLang } from '../../context/LangContext';

const PHASES = [
  {
    num: 'Phase 1', timeEn: 'Q3 2025', timeAr: 'الربع الثالث 2025',
    titleEn: 'Connect Real Data', titleAr: 'ربط البيانات الحقيقية',
    color: 'from-blue-600/15 to-transparent border-blue-500/30', accent: 'text-blue-400', dot: 'bg-blue-400',
    items: [
      { en: 'Live feeds from Jordan e-Government APIs',               ar: 'تدفقات مباشرة من واجهات الحكومة الإلكترونية الأردنية'  },
      { en: 'Citizen feedback platform integrations',                 ar: 'تكاملات منصات ملاحظات المواطنين'                        },
      { en: 'Role-based access: minister vs analyst vs citizen',      ar: 'وصول قائم على الأدوار: وزير / محلل / مواطن'           },
      { en: 'Human-in-loop approvals for high-impact decisions',      ar: 'موافقات بشرية للقرارات عالية التأثير'                  },
    ],
  },
  {
    num: 'Phase 2', timeEn: 'Q4 2025', timeAr: 'الربع الرابع 2025',
    titleEn: 'Expand Across Ministries', titleAr: 'التوسع عبر الوزارات',
    color: 'from-violet-600/15 to-transparent border-violet-500/30', accent: 'text-violet-400', dot: 'bg-violet-400',
    items: [
      { en: 'Deploy twin framework across 5 Jordanian ministries',    ar: 'نشر إطار التوأم في 5 وزارات أردنية'                    },
      { en: 'Cross-ministry signal sharing and joint briefings',      ar: 'مشاركة الإشارات والإحاطات المشتركة بين الوزارات'       },
      { en: 'Cabinet-level consolidated command dashboard',           ar: 'لوحة قيادة موحدة على مستوى مجلس الوزراء'               },
    ],
  },
  {
    num: 'Phase 3', timeEn: 'Q1–Q2 2026', timeAr: 'الربع الأول–الثاني 2026',
    titleEn: 'National Governance Platform', titleAr: 'منصة الحوكمة الوطنية',
    color: 'from-amber-600/15 to-transparent border-amber-500/30', accent: 'text-amber-400', dot: 'bg-amber-400',
    items: [
      { en: 'Jordan National AI Governance Intelligence Platform',    ar: 'منصة الاستخبارات الوطنية للحوكمة بالذكاء الاصطناعي'    },
      { en: 'AI-generated annual national reform agenda',             ar: 'أجندة الإصلاح الوطنية السنوية المولَّدة بالذكاء الاصطناعي' },
      { en: 'Citizen participation portal → policy pipeline',        ar: 'بوابة مشاركة المواطن → مسار السياسات'                  },
      { en: 'Exportable model for other Arab governance systems',     ar: 'نموذج قابل للتصدير لأنظمة الحوكمة العربية الأخرى'      },
    ],
  },
];

export function Roadmap() {
  const { t, isAr } = useLang();
  return (
    <div className="py-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-twin-accent mb-1">{t('Strategic Roadmap', 'خارطة الطريق الاستراتيجية')}</p>
      <h2 className="text-xl font-bold text-slate-100 mb-1">{t('From Prototype to National Platform', 'من نموذج إلى منصة وطنية')}</h2>
      <p className="text-sm text-slate-500 mb-6">{t('Scaling the Minister Digital Twin beyond the hackathon.', 'توسيع نطاق التوأم الرقمي للوزير بعد الهاكاثون.')}</p>

      <div className="space-y-4 mb-8">
        {PHASES.map(ph => (
          <div key={ph.num} className={`bg-gradient-to-br ${ph.color} border rounded-2xl p-5`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold uppercase tracking-widest ${ph.accent}`}>{ph.num}</span>
              <span className="text-slate-600 text-xs">·</span>
              <span className="text-xs text-slate-500">{isAr ? ph.timeAr : ph.timeEn}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-3">{isAr ? ph.titleAr : ph.titleEn}</h3>
            <ul className="space-y-2">
              {ph.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${ph.dot} mt-1.5 shrink-0`} />
                  <span className="text-sm text-slate-300">{isAr ? item.ar : item.en}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-2xl border border-twin-accent/25 bg-twin-accent/5 text-center">
        <p className="text-twin-accent font-bold text-base mb-2">{t('Vision 2026', 'رؤية 2026')}</p>
        <p className="text-sm text-slate-300 leading-relaxed max-w-xl mx-auto">
          {t(
            'Jordan becomes the first Arab nation with a fully AI-powered ministerial intelligence layer — where every decision is evidence-based, every citizen voice is heard, and every policy is tested before it scales.',
            'تصبح الأردن أول دولة عربية تُشغِّل طبقة استخبارات وزارية مدعومة بالكامل بالذكاء الاصطناعي — حيث كل قرار مبني على أدلة، وكل صوت مواطن مسموع، وكل سياسة مُختبَرة قبل التوسع.',
          )}
        </p>
      </div>
    </div>
  );
}
