import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight, RefreshCw, TrendingUp, CheckCircle2, Clock, Activity } from 'lucide-react';
import { fetchIssues, fetchLiveRuns } from '../api';
import { CAPABILITIES, PROJECTS } from '../config';
import { useLang } from '../context/LangContext';
import type { Issue } from '../types';

function pct(issues: Issue[]) {
  if (!issues.length) return 0;
  return Math.round((issues.filter(i => i.status === 'done').length / issues.length) * 100);
}

function StatusBadge({ status }: { status: Issue['status'] }) {
  const map: Record<Issue['status'], string> = {
    in_progress: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    in_review:   'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    todo:        'bg-slate-500/20 text-slate-300 border border-slate-500/30',
    backlog:     'bg-slate-600/20 text-slate-400 border border-slate-600/30',
    done:        'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    cancelled:   'bg-red-500/20 text-red-300 border border-red-500/30',
  };
  return <span className={`badge ${map[status]}`}>{status.replace('_', ' ')}</span>;
}

export function Dashboard() {
  const { t } = useLang();

  const { data: allIssues = [], isLoading: loadingIssues, refetch } = useQuery({
    queryKey: ['issues', 'all'],
    queryFn: () => fetchIssues({ limit: 500 }),
  });

  const { data: runs = [] } = useQuery({
    queryKey: ['runs'],
    queryFn: () => fetchLiveRuns(),
  });

  const total = allIssues.length;
  const done = allIssues.filter(i => i.status === 'done').length;
  const liveRuns = runs.filter((r: { status: string }) => r.status === 'running').length;

  const byProject = (projectId: string) => allIssues.filter(i => i.projectId === projectId);

  const now = new Date().toLocaleDateString(t('en-GB', 'ar-JO'), {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="p-6 min-h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            {t('Minister Digital Twin', 'التوأم الرقمي للوزير')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{now}</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-ghost"
        >
          <RefreshCw size={12} />
          {t('Refresh', 'تحديث')}
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: t('Capabilities', 'القدرات'), value: 7, icon: <Activity size={16} />, color: 'text-violet-400' },
          { label: t('Total Issues', 'إجمالي المهام'), value: total, icon: <Clock size={16} />, color: 'text-blue-400' },
          { label: t('Completed', 'مكتملة'), value: done, icon: <CheckCircle2 size={16} />, color: 'text-emerald-400' },
          { label: t('Live Runs', 'تشغيل مباشر'), value: liveRuns, icon: <TrendingUp size={16} />, color: 'text-amber-400' },
        ].map(m => (
          <div key={m.label} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">{m.label}</span>
              <span className={m.color}>{m.icon}</span>
            </div>
            <p className="text-2xl font-bold text-slate-100">
              {loadingIssues ? '—' : m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Capability grid */}
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        {t('Intelligence Modules', 'وحدات الاستخبارات')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
        {CAPABILITIES.map(cap => {
          const issues = byProject(PROJECTS[cap.key]);
          const p = pct(issues);
          const inProgress = issues.filter(i => i.status === 'in_progress' || i.status === 'in_review');
          const recent = [...issues]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 2);

          return (
            <Link
              key={cap.key}
              to={`/${cap.key}`}
              className="card-hover p-4 block group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg ${cap.bgColor} flex items-center justify-center text-lg`}>
                    {cap.emoji}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{t(cap.labelEn, cap.labelAr)}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{issues.length} {t('tasks', 'مهمة')}</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors mt-1" />
              </div>

              {/* Progress */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-600">{t('Progress', 'التقدم')}</span>
                  <span className={`text-[10px] font-semibold ${cap.color}`}>{p}%</span>
                </div>
                <div className="h-1 rounded-full bg-twin-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-twin-accent to-amber-500 transition-all duration-700"
                    style={{ width: `${p}%` }}
                  />
                </div>
              </div>

              {/* Recent issues */}
              {recent.length > 0 && (
                <div className="space-y-1">
                  {recent.map(issue => (
                    <div key={issue.id} className="flex items-center gap-2">
                      <StatusBadge status={issue.status} />
                      <span className="text-[11px] text-slate-400 truncate">{issue.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {inProgress.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-[10px] text-blue-400">
                    {inProgress.length} {t('in progress', 'قيد التنفيذ')}
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Recent activity */}
      {runs.length > 0 && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            {t('Recent Runs', 'التشغيلات الأخيرة')}
          </h2>
          <div className="card divide-y divide-twin-border overflow-hidden">
            {runs.slice(0, 8).map((run: { id: string; status: string; agentId: string; agentName?: string; issueTitle?: string }) => (
              <div key={run.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  run.status === 'running' ? 'bg-blue-400 animate-pulse' :
                  run.status === 'done' ? 'bg-emerald-400' :
                  run.status === 'error' ? 'bg-red-400' : 'bg-slate-500'
                }`} />
                <span className="text-xs text-slate-300 font-medium truncate flex-1">
                  {run.agentName ?? run.agentId.slice(0, 8)}
                </span>
                {run.issueTitle && (
                  <span className="text-[11px] text-slate-500 truncate max-w-[180px]">
                    {run.issueTitle}
                  </span>
                )}
                <span className={`badge shrink-0 ${
                  run.status === 'running' ? 'bg-blue-500/20 text-blue-300' :
                  run.status === 'done'    ? 'bg-emerald-500/20 text-emerald-300' :
                  run.status === 'error'   ? 'bg-red-500/20 text-red-300' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {run.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
