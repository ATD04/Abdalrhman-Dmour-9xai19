import { useMemo } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardPanel } from '../components/DashboardPanel';
import { ExecCard, ExecListItem } from '../components/ExecCard';
import { SeverityChip, priorityToSeverity } from '../components/SeverityChip';
import { ListSkeleton } from '../components/Skeleton';
import { EmptyBlock } from '../components/EmptyBlock';
import { useLang } from '../context/LangContext';
import { useAutoTranslate } from '../hooks/useAutoTranslate';
import type { Issue } from '../types';

const P_LABEL: Record<string, { en: string; ar: string }> = {
  critical: { en: 'Critical', ar: 'حرجي'   },
  high:     { en: 'High',     ar: 'مرتفع'  },
  medium:   { en: 'Monitor',  ar: 'متابعة' },
  low:      { en: 'Low',      ar: 'منخفض'  },
  none:     { en: 'Info',     ar: 'معلومة' },
};

function chipEl(issue: Issue, isAr: boolean) {
  const sev = priorityToSeverity(issue.priority);
  const pl  = P_LABEL[issue.priority];
  return <SeverityChip severity={sev} labelEn={pl?.en ?? ''} labelAr={pl?.ar ?? ''} isAr={isAr} small />;
}

function pct(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0;
}

export function DecisionsFollowUp() {
  const { t, isAr } = useLang();
  const d = useDashboardData();

  const allTitles = useMemo(() => {
    const set = new Set<string>();
    [...d.decisionsRequired, ...d.policyInsights,
     ...d.readinessItems, ...d.followUps, ...d.escalations
    ].forEach(i => { if (i.title) set.add(i.title); });
    return [...set];
  }, [d.decisionsRequired, d.policyInsights, d.readinessItems, d.followUps, d.escalations]);

  const tx  = useAutoTranslate(allTitles, isAr);
  const ttl = (issue: Issue) => tx(issue.title);

  return (
    <div className="w-full px-5 sm:px-8 py-6">

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-sm font-semibold tracking-widest text-twin-accent mb-1">
            {t('Decisions & Governance', 'قرارات والحوكمة')}
          </p>
          <h1 className="text-4xl font-bold text-slate-100 leading-tight">
            {t('Decisions & Follow-Up', 'القرارات والمتابعة')}
          </h1>
        </div>
        <div className="hidden sm:flex items-center gap-2 pb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-emerald-400 font-semibold">{t('Live', 'مباشر')}</span>
        </div>
      </div>

      {/* ── Main 2-col grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">

        {/* ═══ LEFT ════════════════════════════════════════════ */}
        <div className="flex flex-col gap-5">

          {/* Entity Readiness list */}
          <DashboardPanel label="Entity Readiness" labelAr="جاهزية الجهات" count={d.readinessItems.length} noPadding>
            {d.isLoading ? <div className="p-4"><ListSkeleton count={5} /></div>
            : d.readinessItems.length === 0 ? <div className="p-4"><EmptyBlock messageEn="No data." messageAr="لا بيانات." isAr={isAr} compact /></div>
            : <div>{d.readinessItems.map(i => (
                <ExecListItem key={i.id} title={ttl(i)} severity={priorityToSeverity(i.priority)} chip={chipEl(i, isAr)} />
              ))}</div>}
          </DashboardPanel>

          {/* Reform Progress */}
          <DashboardPanel label="Reform Progress" labelAr="مسيرة الإصلاح">
            {d.isLoading ? <div className="h-48 animate-pulse bg-twin-bg rounded-lg" /> : (
              <div className="space-y-4">
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-3 pb-4 border-b border-twin-border">
                  {[
                    { n: d.weeklyStats.total, l: t('Total', 'المجموع'), c: 'text-slate-200' },
                    { n: d.weeklyStats.done,  l: t('Done',  'مكتمل'),  c: 'text-emerald-400' },
                    { n: d.weeklyStats.active + d.weeklyStats.pending, l: t('Active', 'نشط'), c: 'text-twin-accent' },
                  ].map(s => (
                    <div key={s.l} className="text-center">
                      <p className={`text-3xl font-black tabular-nums ${s.c}`}>{s.n}</p>
                      <p className="text-sm text-slate-500 mt-0.5">{s.l}</p>
                    </div>
                  ))}
                </div>
                {/* Per-module progress bars */}
                {d.weeklyStats.byModule.map(m => (
                  <div key={m.key} className="flex items-center gap-3">
                    <span className="text-sm text-slate-400 w-28 shrink-0 truncate">{isAr ? m.ar : m.en}</span>
                    <div className="flex-1 h-2 bg-twin-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-twin-accent rounded-full transition-all duration-500"
                        style={{ width: `${pct(m.done, m.total)}%` }}
                      />
                    </div>
                    <span className="text-sm text-slate-500 w-10 text-end tabular-nums shrink-0">
                      {pct(m.done, m.total)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </DashboardPanel>

        </div>

        {/* ═══ RIGHT ═══════════════════════════════════════════ */}
        <div className="flex flex-col gap-5">

          {/* Decisions grid */}
          <DashboardPanel label="Decisions & Actions" labelAr="القرارات والإجراءات" count={d.decisionsRequired.length}>
            {d.isLoading ? <ListSkeleton count={4} />
            : d.decisionsRequired.length === 0 ? <EmptyBlock messageEn="No decisions." messageAr="لا قرارات." isAr={isAr} />
            : <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {d.decisionsRequired.map(i => (
                  <ExecCard key={i.id} title={ttl(i)} severity={priorityToSeverity(i.priority)} chip={chipEl(i, isAr)} />
                ))}
              </div>}
          </DashboardPanel>

          {/* Policy Intelligence */}
          <DashboardPanel label="Policy Intelligence" labelAr="الاستخبارات السياساتية" count={d.policyInsights.length}>
            {d.isLoading ? <ListSkeleton count={3} />
            : d.policyInsights.length === 0 ? <EmptyBlock messageEn="No analyses." messageAr="لا تحليلات." isAr={isAr} />
            : <div className="space-y-2">
                {d.policyInsights.map(i => (
                  <ExecCard key={i.id} title={ttl(i)} severity={priorityToSeverity(i.priority)} chip={chipEl(i, isAr)} />
                ))}
              </div>}
          </DashboardPanel>

        </div>
      </div>

      {/* ── Bottom row: 2 tables ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">

        {/* Ministry Actions */}
        <DashboardPanel label="Ministry Actions Taken" labelAr="إجراءات الوزارة المُتَّخَذة" count={d.followUps.length} noPadding>
          {d.isLoading ? <div className="p-4"><ListSkeleton count={4} /></div>
          : d.followUps.length === 0 ? <div className="p-4"><EmptyBlock messageEn="No actions." messageAr="لا إجراءات." isAr={isAr} compact /></div>
          : <div>
              {d.followUps.map((issue, i) => (
                <div key={issue.id} className={`flex items-center gap-3 px-4 py-3.5 border-b border-twin-border last:border-0 ${i % 2 !== 0 ? 'bg-twin-bg/30' : ''}`}>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-base text-slate-300 flex-1 truncate">{ttl(issue)}</span>
                  <SeverityChip severity="good" labelEn="Done" labelAr="مكتمل" isAr={isAr} small />
                </div>
              ))}
            </div>}
        </DashboardPanel>

        {/* Coordinated Outcomes */}
        <DashboardPanel label="Coordinated Outcomes" labelAr="نتائج التنسيق" count={d.escalations.length} noPadding>
          {d.isLoading ? <div className="p-4"><ListSkeleton count={4} /></div>
          : d.escalations.length === 0 ? <div className="p-4"><EmptyBlock messageEn="No outcomes." messageAr="لا نتائج." isAr={isAr} compact /></div>
          : <div>
              {d.escalations.map((issue, i) => (
                <div key={issue.id} className={`flex items-center gap-3 px-4 py-3.5 border-b border-twin-border last:border-0 ${i % 2 !== 0 ? 'bg-twin-bg/30' : ''}`}>
                  <span className="text-base text-slate-300 flex-1 truncate">{ttl(issue)}</span>
                  {chipEl(issue, isAr)}
                </div>
              ))}
            </div>}
        </DashboardPanel>

      </div>

      {d.isError && (
        <div className="fixed bottom-5 end-5 bg-red-500/15 border border-red-500/30 text-red-400 text-sm rounded-xl px-5 py-3">
          {t('Could not reach intelligence system.', 'تعذّر الوصول إلى النظام.')}
        </div>
      )}
    </div>
  );
}
