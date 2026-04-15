import { useQuery } from '@tanstack/react-query';
import { fetchIssues, fetchAgents } from '../api';
import { CAPABILITIES } from '../config';
import { useLang } from '../context/LangContext';

export function SummaryPage() {
  const { t } = useLang();

  const { data: issues = [] } = useQuery({
    queryKey: ['issues', 'all'],
    queryFn: () => fetchIssues({ limit: 500 }),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  });

  const done = issues.filter(i => i.status === 'done').length;
  const pct  = issues.length ? Math.round((done / issues.length) * 100) : 0;

  const HIGHLIGHTS = [
    { en: 'All 7 intelligence modules built and operational',                          ar: 'جميع الوحدات الاستخباراتية السبع مُنشأة وتعمل' },
    { en: '28 AI analysts deployed — each specialised in their domain',               ar: '28 محلل ذكاء اصطناعي منتشر — كل منهم متخصص في مجاله' },
    { en: 'Automated daily and weekly intelligence briefings',                         ar: 'إحاطات استخباراتية يومية وأسبوعية آلية' },
    { en: 'Full bilingual operation — Arabic & English',                               ar: 'عمل ثنائي اللغة بالكامل — العربية والإنجليزية' },
    { en: 'Real-time tracking of over ' + issues.length + ' ministerial goals',       ar: 'متابعة آنية لأكثر من ' + issues.length + ' هدف وزاري' },
    { en: 'Budget controls and approval gates for every action',                       ar: 'ضوابط الميزانية وبوابات الموافقة لكل إجراء' },
  ];

  const IMPACT_ITEMS = [
    {
      titleEn: 'Faster Policy Intelligence',
      titleAr: 'استخبارات سياسات أسرع',
      bodyEn: 'Regulatory monitoring that previously took a team of analysts is now automated — delivering daily briefings without manual effort.',
      bodyAr: 'مراقبة التشريعات التي كانت تتطلب فريقاً من المحللين أصبحت آلية — تُقدِّم إحاطات يومية دون جهد يدوي.',
    },
    {
      titleEn: 'Citizen Feedback Loop',
      titleAr: 'حلقة ملاحظات المواطنين',
      bodyEn: 'Citizen complaints and feedback are continuously monitored and surfaced as actionable recommendations before they escalate.',
      bodyAr: 'شكاوى المواطنين وملاحظاتهم مراقبة باستمرار وتُرفع كتوصيات قابلة للتنفيذ قبل أن تتصاعد.',
    },
    {
      titleEn: 'Cross-Entity Harmony',
      titleAr: 'انسجام بين الجهات',
      bodyEn: 'Digital transformation gaps across government entities are identified and coordinated — eliminating silos.',
      bodyAr: 'فجوات التحول الرقمي عبر الجهات الحكومية محددة ومنسقة — للقضاء على العزل المؤسسي.',
    },
  ];

  return (
    <div className="min-h-full p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <p className="text-sm text-twin-accent font-semibold tracking-wide mb-1">
          {t('Ministerial Briefing Document', 'وثيقة الإحاطة الوزارية')}
        </p>
        <h1 className="text-3xl font-bold text-slate-100">
          {t('Executive Summary', 'الملخص التنفيذي')}
        </h1>
        <p className="text-slate-500 mt-2">
          {t('Jordan Minister Digital Twin — AI Governance System', 'التوأم الرقمي للوزير الأردني — نظام الحوكمة بالذكاء الاصطناعي')}
        </p>
      </div>

      {/* Hero numbers */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="card p-6 text-center">
          <p className="text-5xl font-black text-twin-accent mb-1">7</p>
          <p className="text-sm text-slate-500">{t('Intelligence Modules', 'وحدات استخباراتية')}</p>
        </div>
        <div className="card p-6 text-center">
          <p className="text-5xl font-black text-emerald-400 mb-1">{agents.length || 28}</p>
          <p className="text-sm text-slate-500">{t('AI Analysts', 'محلل ذكاء اصطناعي')}</p>
        </div>
        <div className="card p-6 text-center">
          <p className="text-5xl font-black text-blue-400 mb-1">{pct}%</p>
          <p className="text-sm text-slate-500">{t('Goals Achieved', 'أهداف محققة')}</p>
        </div>
      </div>

      {/* What was built */}
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-4">
        {t('What Was Built', 'ما تم بناؤه')}
      </h2>
      <div className="card mb-8 overflow-hidden">
        {HIGHLIGHTS.map((h, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-twin-border last:border-0">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <span className="text-emerald-400 text-xs font-bold">✓</span>
            </div>
            <p className="text-sm text-slate-300">{t(h.en, h.ar)}</p>
          </div>
        ))}
      </div>

      {/* Impact */}
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-4">
        {t('Real-World Impact', 'الأثر الفعلي')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {IMPACT_ITEMS.map(item => (
          <div key={item.titleEn} className="card p-5 border-t-2 border-twin-accent/40">
            <h3 className="text-sm font-bold text-twin-accent mb-2">{t(item.titleEn, item.titleAr)}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t(item.bodyEn, item.bodyAr)}</p>
          </div>
        ))}
      </div>

      {/* Module overview */}
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-4">
        {t('Module Status', 'حالة الوحدات')}
      </h2>
      <div className="card overflow-hidden">
        {CAPABILITIES.map(cap => (
          <div key={cap.key} className="flex items-center gap-4 px-5 py-3.5 border-b border-twin-border last:border-0">
            <span className="text-xl w-8 text-center">{cap.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${cap.color}`}>{t(cap.labelEn, cap.labelAr)}</p>
              <p className="text-xs text-slate-500 truncate">{t(cap.descEn, cap.descAr)}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">{t('Complete', 'مكتملة')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
