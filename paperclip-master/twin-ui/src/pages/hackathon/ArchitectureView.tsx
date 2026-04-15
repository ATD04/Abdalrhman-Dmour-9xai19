import { useLang } from '../../context/LangContext';
import { COMPANY_ID } from '../../config';

const LAYERS = [
  {
    labelEn: 'Minister UI Layer', labelAr: 'طبقة واجهة الوزير',
    items: ['React 18 + Vite 5 · Port 3200', 'TanStack Query · Tailwind CSS 3', '2-page minister UX + 4 hackathon assets', 'Bilingual AR/EN + RTL support'],
    col: 'border-violet-500/40',
  },
  {
    labelEn: '7 Intelligence Modules', labelAr: '7 وحدات استخباراتية',
    items: ['Executive Radar', 'Service Friction Intelligence', 'Citizen Voice Translator', 'Institutional Readiness Analyzer', 'Policy Impact Assistant', 'Cross-Entity Coordination Engine', 'Ministerial Chief of Staff Office'],
    col: 'border-amber-500/40',
  },
  {
    labelEn: 'Paperclip Control Plane', labelAr: 'وحدة تحكم Paperclip',
    items: ['28 AI Agents — Claude 3.5 Sonnet', '21 Automated Routines (daily/weekly)', 'Issue-based task model with priorities', 'Budget controls + approval gates', 'Activity audit trail'],
    col: 'border-blue-500/40',
  },
  {
    labelEn: 'Data & Infrastructure', labelAr: 'البيانات والبنية التحتية',
    items: ['PGlite embedded PostgreSQL (dev)', 'Drizzle ORM — type-safe schema', `Company ID: ${COMPANY_ID}`, 'Express REST API · Port 3100'],
    col: 'border-slate-500/40',
  },
];

const OUTPUT_MAP = [
  { capEn: 'Executive Radar',             capAr: 'الرادار التنفيذي',             feedsEn: 'Daily Brief · Today\'s Priorities · Watchlist',                      feedsAr: 'الإحاطة اليومية · الأولويات · قائمة المراقبة'     },
  { capEn: 'Service Friction Intelligence', capAr: 'استخبارات احتكاك الخدمات', feedsEn: 'Service Pain Points · Quick Wins',                                    feedsAr: 'نقاط ألم الخدمات'                                  },
  { capEn: 'Citizen Voice Translator',    capAr: 'مترجم صوت المواطن',            feedsEn: 'Public Pulse · Trust Signals',                                        feedsAr: 'نبض المواطنين · إشارات الثقة'                      },
  { capEn: 'Cross-Entity Coordination',   capAr: 'التنسيق بين الجهات',           feedsEn: 'Coordination Alerts · Escalations',                                  feedsAr: 'تنبيهات التنسيق · التصعيد'                         },
  { capEn: 'Institutional Readiness',     capAr: 'الجاهزية المؤسسية',           feedsEn: 'Readiness Snapshot',                                                  feedsAr: 'لقطة الجاهزية'                                     },
  { capEn: 'Policy Impact Assistant',     capAr: 'مساعد تأثير السياسات',        feedsEn: 'Decisions Required · Policy Tradeoffs',                               feedsAr: 'القرارات المطلوبة · مقايضات السياسات'              },
  { capEn: 'Chief of Staff Office',       capAr: 'مكتب رئيس الديوان',           feedsEn: 'Daily Brief · Follow-Up Tracker · Weekly Reform Movement',           feedsAr: 'الإحاطة · متابعة الالتزامات · حركة الإصلاح'       },
];

export function ArchitectureView() {
  const { t, isAr } = useLang();
  return (
    <div className="py-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-twin-accent mb-1">{t('System Architecture', 'بنية النظام')}</p>
      <h2 className="text-xl font-bold text-slate-100 mb-1">{t('Minister Digital Twin', 'التوأم الرقمي للوزير')}</h2>
      <p className="text-sm text-slate-500 mb-6">{t('Full-stack AI governance system — Jordan Ministry of Public Sector Development', 'نظام حوكمة AI متكامل — وزارة تطوير القطاع العام الأردنية')}</p>

      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('System Layers', 'طبقات النظام')}</h3>
      <div className="space-y-3 mb-8">
        {LAYERS.map(l => (
          <div key={l.labelEn} className={`bg-twin-card border border-s-2 ${l.col} rounded-xl p-4`}>
            <p className="text-sm font-bold text-slate-200 mb-2">{isAr ? l.labelAr : l.labelEn}</p>
            <div className="flex flex-wrap gap-2">
              {l.items.map(item => (
                <span key={item} className="text-xs text-slate-400 bg-twin-bg border border-twin-border rounded-md px-2 py-0.5">{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">{t('Capability → Output Mapping', 'الخريطة: وحدة → مخرج')}</h3>
      <div className="bg-twin-card border border-twin-border rounded-xl overflow-hidden">
        {OUTPUT_MAP.map((row, i) => (
          <div key={i} className="flex items-start gap-4 px-4 py-3 border-b border-twin-border last:border-0">
            <span className="text-sm font-semibold text-twin-accent w-44 shrink-0">{isAr ? row.capAr : row.capEn}</span>
            <span className="text-xs text-slate-400">→</span>
            <span className="text-xs text-slate-400">{isAr ? row.feedsAr : row.feedsEn}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { n: '7', l: { en: 'Capabilities', ar: 'قدرات' } },
          { n: '28', l: { en: 'AI Agents', ar: 'وكيل ذكاء' } },
          { n: '21', l: { en: 'Routines', ar: 'روتينات' } },
          { n: '2', l: { en: 'Minister Pages', ar: 'صفحات وزارية' } },
        ].map(s => (
          <div key={s.n} className="bg-twin-card border border-twin-border rounded-xl p-4 text-center">
            <p className="text-3xl font-black text-twin-accent mb-1">{s.n}</p>
            <p className="text-[11px] text-slate-500">{isAr ? s.l.ar : s.l.en}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
