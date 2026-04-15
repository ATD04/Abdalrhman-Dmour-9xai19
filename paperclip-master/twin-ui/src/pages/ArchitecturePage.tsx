import { useLang } from '../context/LangContext';
import { CAPABILITIES, COMPANY_ID } from '../config';

const TECH = [
  { name: 'Paperclip', role: 'Control Plane', roleAr: 'وحدة التحكم', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { name: 'Claude 3.5 Sonnet', role: 'AI Backbone', roleAr: 'العمود الفقري للذكاء الاصطناعي', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { name: 'PGlite / PostgreSQL', role: 'Persistence', roleAr: 'التخزين الدائم', color: 'text-green-400', bg: 'bg-green-500/10' },
  { name: 'React + Vite', role: 'Twin UI', roleAr: 'واجهة التوأم', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { name: 'TypeScript', role: 'Type Safety', roleAr: 'أمان الأنواع', color: 'text-blue-300', bg: 'bg-blue-500/10' },
];

const LAYERS = [
  {
    labelEn: 'Presentation Layer',
    labelAr: 'طبقة العرض',
    items: ['React 18 + Vite. Twin UI (port 3200)', 'Paperclip Board UI (port 3100)'],
    color: 'border-violet-500/40',
  },
  {
    labelEn: 'Intelligence Modules (7 Sprints)',
    labelAr: 'وحدات الاستخبارات (7 سبرينت)',
    items: CAPABILITIES.map(c => `${c.emoji} ${c.labelEn} — ${c.labelAr}`),
    color: 'border-amber-500/40',
  },
  {
    labelEn: 'Agent Fleet (28 Agents)',
    labelAr: 'أسطول الوكلاء (28 وكيل)',
    items: [
      '3–4 agents per capability (Chief + 2–3 analysts)',
      'Chief of Staff — cross-cutting coordination',
      'Role-specific system prompts in Arabic/English',
    ],
    color: 'border-blue-500/40',
  },
  {
    labelEn: 'Orchestration Layer',
    labelAr: 'طبقة التنسيق',
    items: [
      'Paperclip task model: Issues → Agent Runs → Comments',
      '21 Routines — daily/weekly automation',
      'Budget caps, approval gates, activity log',
    ],
    color: 'border-emerald-500/40',
  },
  {
    labelEn: 'Data & Infrastructure',
    labelAr: 'البيانات والبنية التحتية',
    items: [
      'PGlite embedded PostgreSQL (dev) / Postgres (prod)',
      'Drizzle ORM — type-safe schema',
      `Company ID: ${COMPANY_ID}`,
    ],
    color: 'border-slate-500/40',
  },
];

export function ArchitecturePage() {
  const { t } = useLang();

  return (
    <div className="p-6 min-h-full">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-100">
          {t('System Architecture', 'بنية النظام')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t(
            'Minister Digital Twin — full-stack AI agent system built on Paperclip',
            'التوأم الرقمي للوزير — نظام وكلاء ذكاء اصطناعي متكامل مبني على Paperclip',
          )}
        </p>
      </div>

      {/* Tech stack */}
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        {t('Technology Stack', 'مكدس التقنيات')}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        {TECH.map(t2 => (
          <div key={t2.name} className={`card p-3 ${t2.bg} border border-twin-border`}>
            <p className={`text-xs font-bold ${t2.color}`}>{t2.name}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{t(t2.role, t2.roleAr)}</p>
          </div>
        ))}
      </div>

      {/* Architecture layers */}
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        {t('Layered Architecture', 'البنية المتدرجة')}
      </h2>
      <div className="space-y-3 mb-6">
        {LAYERS.map(layer => (
          <div key={layer.labelEn} className={`card p-4 border-l-2 ${layer.color}`}>
            <p className="text-sm font-semibold text-slate-200 mb-2">
              {t(layer.labelEn, layer.labelAr)}
            </p>
            <ul className="space-y-1">
              {layer.items.map(item => (
                <li key={item} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="text-slate-600 mt-0.5">›</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Agent topology */}
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        {t('Agent Topology', 'طوبولوجيا الوكلاء')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CAPABILITIES.map(cap => (
          <div key={cap.key} className="card p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{cap.emoji}</span>
              <span className={`text-sm font-medium ${cap.color}`}>{t(cap.labelEn, cap.labelAr)}</span>
            </div>
            <p className="text-xs text-slate-500">{t(cap.descEn, cap.descAr)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
