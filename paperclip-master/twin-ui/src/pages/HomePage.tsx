import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Shield, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { fetchIssues } from '../api';
import { CAPABILITIES, PROJECTS } from '../config';
import { useLang } from '../context/LangContext';
import type { Issue } from '../types';

/* ── helpers ── */
function moduleStatus(issues: Issue[]): 'complete' | 'active' | 'pending' {
  if (!issues.length) return 'pending';
  const active = issues.filter(i => i.status === 'in_progress' || i.status === 'in_review');
  if (active.length > 0) return 'active';
  const done = issues.filter(i => i.status === 'done').length;
  if (done / issues.length >= 0.8) return 'complete';
  return 'pending';
}

const STATUS_LABEL = {
  complete: { en: 'Complete',   ar: 'مكتمل',       dot: 'bg-emerald-400', text: 'text-emerald-400',  pill: 'bg-emerald-500/10 border-emerald-500/20' },
  active:   { en: 'In Progress',ar: 'جارٍ تنفيذه', dot: 'bg-blue-400 animate-pulse', text: 'text-blue-400',     pill: 'bg-blue-500/10 border-blue-500/20'     },
  pending:  { en: 'Standby',    ar: 'في الانتظار', dot: 'bg-slate-500',   text: 'text-slate-500',    pill: 'bg-slate-500/10 border-slate-500/20'   },
} as const;

function getGreeting(lang: 'en' | 'ar') {
  const h = new Date().getHours();
  if (lang === 'ar') {
    if (h < 12) return 'صباح الخير، معالي الوزير';
    if (h < 17) return 'نهارك طيب، معالي الوزير';
    return 'مساء الخير، معالي الوزير';
  }
  if (h < 12) return 'Good morning, Minister';
  if (h < 17) return 'Good afternoon, Minister';
  return 'Good evening, Minister';
}

function formatDate(lang: 'en' | 'ar') {
  return new Date().toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/* ── component ── */
export function HomePage() {
  const { lang, t } = useLang();

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ['issues', 'all'],
    queryFn: () => fetchIssues({ limit: 500 }),
  });

  const total    = issues.length;
  const done     = issues.filter(i => i.status === 'done').length;
  const active   = issues.filter(i => i.status === 'in_progress' || i.status === 'in_review').length;
  const complete = CAPABILITIES.filter(c => moduleStatus(issues.filter(i => i.projectId === PROJECTS[c.key])) === 'complete').length;

  return (
    <div className="min-h-full p-8 max-w-5xl mx-auto">

      {/* Greeting header */}
      <div className="mb-10">
        <p className="text-sm text-twin-accent font-semibold tracking-wide mb-1">
          {formatDate(lang)}
        </p>
        <h1 className="text-3xl font-bold text-slate-100">
          {getGreeting(lang)} 👋
        </h1>
        <p className="text-slate-500 mt-2 text-base">
          {t(
            'Your AI intelligence system is monitoring 7 strategic domains.',
            'نظام الذكاء الاصطناعي الخاص بك يراقب 7 مجالات استراتيجية.',
          )}
        </p>
      </div>

      {/* Top-line metrics — 3 cards */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <span className="text-sm text-slate-400">{t('Modules Completed', 'وحدات مكتملة')}</span>
          </div>
          <p className="text-4xl font-black text-slate-100">{isLoading ? '—' : complete}<span className="text-lg text-slate-600">/7</span></p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Clock size={16} className="text-blue-400" />
            </div>
            <span className="text-sm text-slate-400">{t('Active Analyses', 'تحليلات نشطة')}</span>
          </div>
          <p className="text-4xl font-black text-slate-100">{isLoading ? '—' : active}</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-twin-accent/15 flex items-center justify-center">
              <Shield size={16} className="text-twin-accent" />
            </div>
            <span className="text-sm text-slate-400">{t('Intelligence Reports', 'تقارير الاستخبارات')}</span>
          </div>
          <p className="text-4xl font-black text-slate-100">{isLoading ? '—' : done}</p>
        </div>
      </div>

      {/* System-wide progress */}
      {total > 0 && (
        <div className="card p-5 mb-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-300">
              {t('Overall Progress', 'التقدم الإجمالي')}
            </span>
            <span className="text-xl font-black text-twin-accent">
              {Math.round((done / total) * 100)}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-twin-border overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-twin-accent to-amber-400 transition-all duration-1000"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-600 mt-2">
            {done} {t('of', 'من')} {total} {t('intelligence tasks completed', 'مهمة استخباراتية مكتملة')}
          </p>
        </div>
      )}

      {/* Intelligence modules grid */}
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-4">
        {t('Intelligence Modules', 'وحدات الاستخبارات')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CAPABILITIES.map(cap => {
          const capIssues = issues.filter(i => i.projectId === PROJECTS[cap.key]);
          const st = moduleStatus(capIssues);
          const sl = STATUS_LABEL[st];
          const doneCap = capIssues.filter(i => i.status === 'done').length;
          const pct = capIssues.length ? Math.round((doneCap / capIssues.length) * 100) : 0;

          // Get latest finding (most recent done issue title)
          const latestFinding = capIssues
            .filter(i => i.status === 'done')
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

          return (
            <div key={cap.key} className={`card p-5 border ${cap.borderColor} hover:bg-twin-hover/30 transition-colors`}>
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-11 h-11 rounded-2xl ${cap.bgColor} flex items-center justify-center text-2xl shrink-0 mt-0.5`}>
                  {cap.emoji}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title + status */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-base font-bold text-slate-100">
                      {t(cap.labelEn, cap.labelAr)}
                    </span>
                    <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sl.pill} ${sl.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sl.dot}`} />
                      {t(sl.en, sl.ar)}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-500 mb-3 leading-relaxed">
                    {t(cap.descEn, cap.descAr)}
                  </p>

                  {/* Latest finding */}
                  {latestFinding && (
                    <div className="flex items-start gap-2 mb-3 p-2.5 rounded-lg bg-twin-bg border border-twin-border">
                      <AlertTriangle size={12} className="text-twin-accent shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        <span className="text-twin-accent font-medium">{t('Latest: ', 'الأحدث: ')}</span>
                        {latestFinding.title}
                      </p>
                    </div>
                  )}

                  {/* Progress mini-bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 rounded-full bg-twin-border overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${cap.bgColor.replace('/10', '')}`}
                        style={{ width: `${pct}%`, opacity: 0.8 }}
                      />
                    </div>
                    <span className={`text-xs font-semibold ${cap.color} shrink-0`}>{pct}%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-end gap-3">
        <Link to="/demo" className="btn-ghost text-sm px-4 py-2">
          {t('View Live Demo →', 'عرض مباشر ←')}
        </Link>
        <Link to="/summary" className="btn-primary text-sm px-4 py-2">
          {t('Executive Summary', 'الملخص التنفيذي')}
        </Link>
      </div>
    </div>
  );
}
