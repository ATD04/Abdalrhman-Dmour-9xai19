import { useQuery } from '@tanstack/react-query';
import { fetchIssues } from '../api';
import { PROJECTS } from '../config';
import { useLang } from '../context/LangContext';
import type { Issue } from '../types';

const FLOW: {
  step: number;
  emoji: string;
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
  outputEn: string;
  outputAr: string;
  capKey: keyof typeof PROJECTS;
}[] = [
  {
    step: 1, emoji: '📡',
    titleEn:  'Regulatory Radar scans the environment',
    titleAr:  'رادار التشريعات يستطلع البيئة',
    descEn:   'The system automatically monitors policy signals, new laws, and regulatory updates across all government domains.',
    descAr:   'يراقب النظام تلقائياً الإشارات السياسية والقوانين الجديدة والتحديثات التشريعية عبر جميع المجالات الحكومية.',
    outputEn: 'Delivers a flagged briefing on regulations requiring ministerial attention',
    outputAr: 'يُقدِّم إحاطة مُعلَّمة بالتشريعات التي تتطلب الاهتمام الوزاري',
    capKey:   'radar',
  },
  {
    step: 2, emoji: '🔍',
    titleEn:  'Friction Finder diagnoses service delivery gaps',
    titleAr:  'كاشف الإجراءات يشخص ثغرات تقديم الخدمات',
    descEn:   'Identifies where citizens face unnecessary complexity, delays, or barriers in government services.',
    descAr:   'يحدد المواضع التي يواجه فيها المواطنون تعقيدات أو تأخيرات أو عقبات غير ضرورية في الخدمات الحكومية.',
    outputEn: 'Root-cause report with the top 3 friction points and recommended fixes',
    outputAr: 'تقرير الجذور مع أعلى 3 نقاط احتكاك والإصلاحات الموصى بها',
    capKey:   'friction',
  },
  {
    step: 3, emoji: '🗣️',
    titleEn:  'Citizen Voice aggregates public sentiment',
    titleAr:  'صوت المواطن يجمع المشاعر العامة',
    descEn:   'Continuously listens to citizen feedback, classifies sentiment, and surfaces urgent signals before they become crises.',
    descAr:   'يُصغي باستمرار لملاحظات المواطنين ويُصنِّف المشاعر ويرفع الإشارات العاجلة قبل أن تتحول إلى أزمات.',
    outputEn: 'Sentiment dashboard with escalation alerts',
    outputAr: 'لوحة المشاعر مع تنبيهات التصعيد',
    capKey:   'voice',
  },
  {
    step: 4, emoji: '⚗️',
    titleEn:  'Policy Pilot designs a targeted experiment',
    titleAr:  'تجريب السياسات يصمم تجربة مُستهدفة',
    descEn:   'Designs small, low-risk policy experiments to test reforms before rolling them out nationally.',
    descAr:   'يصمم تجارب سياسية صغيرة ومنخفضة المخاطر لاختبار الإصلاحات قبل تطبيقها على المستوى الوطني.',
    outputEn: 'Experiment brief: hypothesis, KPIs, success criteria, and timeline',
    outputAr: 'ملخص التجربة: الفرضية ومؤشرات الأداء ومعايير النجاح والجدول الزمني',
    capKey:   'policy',
  },
  {
    step: 5, emoji: '🏛️',
    titleEn:  'Chief of Staff synthesises the ministerial briefing',
    titleAr:  'رئيس الديوان يُجمِّع الإحاطة الوزارية',
    descEn:   'Integrates intelligence from all modules into a single concise brief for ministerial decision-making.',
    descAr:   'يدمج الاستخبارات من جميع الوحدات في إحاطة موجزة واحدة لصنع القرار الوزاري.',
    outputEn: 'One-page executive brief ready for minister review and signature',
    outputAr: 'إحاطة تنفيذية من صفحة واحدة جاهزة لمراجعة الوزير وتوقيعه',
    capKey:   'cos',
  },
];

function statusBadge(issues: Issue[]) {
  const done = issues.filter(i => i.status === 'done').length;
  const active = issues.filter(i => i.status === 'in_progress').length;
  if (active > 0) return { en: 'In Progress', ar: 'جارٍ', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/25' };
  if (done > 0)   return { en: 'Complete',    ar: 'مكتمل', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' };
  return           { en: 'Ready',        ar: 'جاهز',  cls: 'bg-slate-500/15 text-slate-400 border-slate-500/25' };
}

export function DemoPage() {
  const { t } = useLang();

  const { data: issues = [] } = useQuery({
    queryKey: ['issues', 'all'],
    queryFn: () => fetchIssues({ limit: 500 }),
  });

  return (
    <div className="min-h-full p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <p className="text-sm text-twin-accent font-semibold tracking-wide mb-1">
          {t('End-to-End Intelligence Chain', 'سلسلة الاستخبارات الشاملة')}
        </p>
        <h1 className="text-3xl font-bold text-slate-100">
          {t('How It Works', 'كيف يعمل النظام')}
        </h1>
        <p className="text-slate-500 mt-2 text-base">
          {t(
            'From raw signals to a ministerial briefing — five steps, fully automated.',
            'من الإشارات الخام إلى الإحاطة الوزارية — خمس خطوات، مؤتمتة بالكامل.',
          )}
        </p>
      </div>

      {/* Flow */}
      <div className="relative">
        {/* Connector line */}
        <div className="absolute left-8 top-12 bottom-12 w-px bg-gradient-to-b from-twin-accent/40 via-twin-border to-transparent" />

        <div className="space-y-6">
          {FLOW.map((step, idx) => {
            const stepIssues = issues.filter(i => i.projectId === PROJECTS[step.capKey]);
            const badge = statusBadge(stepIssues);
            const isLast = idx === FLOW.length - 1;

            return (
              <div key={step.step} className="relative flex gap-6">
                {/* Step number bubble */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-twin-card border border-twin-border flex flex-col items-center justify-center z-10 shadow-lg">
                    <span className="text-2xl">{step.emoji}</span>
                    <span className="text-[10px] text-slate-600 font-bold">{step.step}</span>
                  </div>
                </div>

                {/* Content card */}
                <div className={`flex-1 card p-5 mb-2 ${isLast ? 'border-twin-accent/30 bg-twin-accent/5' : ''}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-bold text-slate-100 leading-snug">
                      {t(step.titleEn, step.titleAr)}
                    </h3>
                    <span className={`badge border shrink-0 ${badge.cls}`}>
                      {t(badge.en, badge.ar)}
                    </span>
                  </div>

                  <p className="text-sm text-slate-400 leading-relaxed mb-3">
                    {t(step.descEn, step.descAr)}
                  </p>

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-twin-bg border border-twin-border">
                    <span className="text-twin-accent text-sm shrink-0">→</span>
                    <p className="text-xs text-slate-400">
                      <span className="text-twin-accent font-semibold">{t('Output: ', 'المخرج: ')}</span>
                      {t(step.outputEn, step.outputAr)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer note */}
      <div className="mt-8 p-5 rounded-2xl bg-twin-surface border border-twin-border text-center">
        <p className="text-sm text-slate-400">
          {t(
            'All steps run automatically on a daily schedule. The minister receives a consolidated briefing every morning.',
            'تعمل جميع الخطوات تلقائياً وفق جدول يومي. يتلقى الوزير إحاطة موحدة كل صباح.',
          )}
        </p>
      </div>
    </div>
  );
}
