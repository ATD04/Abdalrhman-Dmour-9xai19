import { useQuery } from '@tanstack/react-query';
import { fetchIssues, fetchAgents } from '../../api';
import { CAPABILITIES } from '../../config';
import { useLang } from '../../context/LangContext';

const ACHIEVEMENTS = [
  { en: '7 intelligence modules — fully built and operational',                ar: '7 وحدات استخباراتية — مُنشأة وتعمل بالكامل'             },
  { en: '28 AI agents — each specialised in a governance domain',              ar: '28 وكيل ذكاء اصطناعي متخصص في مجال حوكمة'              },
  { en: '21 automated routines — daily and weekly intelligence cycles',        ar: '21 روتيناً آلياً لدورات استخباراتية يومية وأسبوعية'      },
  { en: 'One integrated ministerial platform — not 7 separate demos',         ar: 'منصة وزارية واحدة متكاملة — ليست 7 عروض منفصلة'         },
  { en: 'Bilingual Arabic / English with full RTL support',                    ar: 'ثنائي اللغة عربي/إنجليزي مع دعم كامل للـ RTL'           },
  { en: 'Real Paperclip data integration — no fake outputs',                   ar: 'تكامل حقيقي مع بيانات Paperclip — لا مخرجات مزيفة'      },
  { en: 'Minister sees only executive outputs — zero technical exposure',      ar: 'الوزير يرى المخرجات التنفيذية فقط — صفر تعقيدات تقنية'  },
];

const IMPACT = [
  { titleEn: 'Hours Saved', titleAr: 'ساعات موفورة', bodyEn: 'Regulatory monitoring that required a team of analysts is now automated — daily briefings generated without manual effort.', bodyAr: 'مراقبة التشريعات التي كانت تحتاج فريقاً أصبحت آلية — إحاطات يومية دون جهد يدوي.' },
  { titleEn: 'Proactive Governance', titleAr: 'حوكمة استباقية', bodyEn: 'Citizen complaints surfaced before they escalate. Service friction identified before it becomes a crisis.', bodyAr: 'شكاوى المواطنين تُرصد قبل تصعيدها. الاحتكاك يُكشف قبل تحوله أزمة.' },
  { titleEn: 'Evidence-Based Decisions', titleAr: 'قرارات مبنية على أدلة', bodyEn: 'Every decision on Page 2 comes with AI-synthesised context, tradeoff analysis, and readiness data.', bodyAr: 'كل قرار مدعوم بسياق موُلَّد بالذكاء الاصطناعي وتحليل المقايضات وبيانات الجاهزية.' },
];

export function ExecSummary() {
  const { t, isAr } = useLang();

  const { data: issues = [] } = useQuery({ queryKey: ['issues', 'all'], queryFn: () => fetchIssues({ limit: 500 }) });
  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: fetchAgents });

  const done  = issues.filter(i => i.status === 'done').length;
  const total = issues.filter(i => i.status !== 'cancelled').length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="py-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-twin-accent mb-1">{t('For Judges & Stakeholders', 'للمحكمين وأصحاب المصلحة')}</p>
      <h2 className="text-xl font-bold text-slate-100 mb-1">{t('Executive Summary', 'الملخص التنفيذي')}</h2>
      <p className="text-sm text-slate-500 mb-6">{t('Jordan Minister Digital Twin — AI Governance Hackathon', 'التوأم الرقمي للوزير الأردني — هاكاثون حوكمة الذكاء الاصطناعي')}</p>

      <div className="grid grid-cols-3 gap-3 mb-7">
        {[
          { v: '7',              l: { en: 'Intelligence Modules', ar: 'وحدات استخباراتية' }, c: 'text-violet-400' },
          { v: String(agents.length || 28), l: { en: 'AI Agents',     ar: 'وكيل ذكاء اصطناعي' }, c: 'text-amber-400'  },
          { v: `${pct}%`,        l: { en: 'Tasks Completed',    ar: 'مهام مكتملة'       }, c: 'text-emerald-400'},
        ].map(s => (
          <div key={s.l.en} className="bg-twin-card border border-twin-border rounded-xl p-5 text-center">
            <p className={`text-4xl font-black ${s.c} mb-1`}>{s.v}</p>
            <p className="text-xs text-slate-500">{isAr ? s.l.ar : s.l.en}</p>
          </div>
        ))}
      </div>

      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('What Was Built', 'ما تم بناؤه')}</h3>
      <div className="bg-twin-card border border-twin-border rounded-xl mb-6 overflow-hidden">
        {ACHIEVEMENTS.map((a, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-twin-border last:border-0">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <span className="text-emerald-400 text-[10px] font-bold">✓</span>
            </div>
            <p className="text-sm text-slate-300">{isAr ? a.ar : a.en}</p>
          </div>
        ))}
      </div>

      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('Impact', 'الأثر')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {IMPACT.map(imp => (
          <div key={imp.titleEn} className="bg-twin-card border border-t-2 border-twin-accent/30 rounded-xl p-4">
            <p className="text-sm font-bold text-twin-accent mb-2">{isAr ? imp.titleAr : imp.titleEn}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{isAr ? imp.bodyAr : imp.bodyEn}</p>
          </div>
        ))}
      </div>

      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('All 7 Modules', 'الوحدات السبع')}</h3>
      <div className="bg-twin-card border border-twin-border rounded-xl overflow-hidden">
        {CAPABILITIES.map(cap => (
          <div key={cap.key} className="flex items-center gap-3 px-4 py-3 border-b border-twin-border last:border-0">
            <span className="text-lg w-7 text-center">{cap.emoji}</span>
            <span className={`text-sm font-semibold ${cap.color} flex-1`}>{isAr ? cap.labelAr : cap.labelEn}</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">{t('Operational', 'تشغيلية')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
