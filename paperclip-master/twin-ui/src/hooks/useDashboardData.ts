import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchIssues } from '../api';
import { PROJECTS } from '../config';
import type { Issue, IssuePriority } from '../types';
import type { CapKey } from '../config';

// ─── helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<IssuePriority, number> = {
  critical: 0, high: 1, medium: 2, low: 3, none: 4,
};

function latestFirst(issues: Issue[]) {
  return [...issues].sort(
    (a, b) => new Date(b.lastActivityAt ?? b.updatedAt).getTime() - new Date(a.lastActivityAt ?? a.updatedAt).getTime()
  );
}

function byProject(issues: Issue[], key: CapKey) {
  return issues.filter(i => i.projectId === PROJECTS[key]);
}

function visible(i: Issue)      { return i.status !== 'cancelled'; }
function isDone(i: Issue)       { return i.status === 'done'; }
function isActive(i: Issue)     { return i.status === 'in_progress' || i.status === 'in_review'; }
function isPending(i: Issue)    { return i.status === 'todo' || i.status === 'backlog'; }
function highPrio(i: Issue)     { return i.priority === 'critical' || i.priority === 'high'; }
function medPlusPrio(i: Issue)  { return i.priority === 'critical' || i.priority === 'high' || i.priority === 'medium'; }

// Sort: prioritise active > pending > done; within same category sort by priority+recency
function sortExecutive(issues: Issue[]) {
  return [...issues].sort((a, b) => {
    const stateScore = (i: Issue) => isActive(i) ? 0 : isPending(i) ? 1 : 2;
    if (stateScore(a) !== stateScore(b)) return stateScore(a) - stateScore(b);
    if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority])
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    return new Date(b.lastActivityAt ?? b.updatedAt).getTime() - new Date(a.lastActivityAt ?? a.updatedAt).getTime();
  });
}

// ─── types ────────────────────────────────────────────────────────────────────

export interface ModuleHealth {
  key: CapKey;
  en: string;
  ar: string;
  total: number;
  done: number;
  hasCritical: boolean;
  hasHigh: boolean;
}

export interface WeeklyStats {
  total: number;
  done: number;
  active: number;
  pending: number;
  byModule: { key: CapKey; en: string; ar: string; done: number; total: number }[];
}

const PROJECT_LABELS: Record<CapKey, { en: string; ar: string }> = {
  cos:          { en: 'Chief of Staff',  ar: 'رئيس الديوان'     },
  radar:        { en: 'Exec. Radar',     ar: 'الرادار التنفيذي'  },
  friction:     { en: 'Svc. Friction',   ar: 'احتكاك الخدمات'  },
  voice:        { en: 'Citizen Voice',   ar: 'صوت المواطن'      },
  readiness:    { en: 'Readiness',       ar: 'الجاهزية'          },
  policy:       { en: 'Policy',          ar: 'السياسات'          },
  coordination: { en: 'Coordination',    ar: 'التنسيق'           },
};

export interface DashboardData {
  // Executive overview — top-level
  topIssues: Issue[];           // most recent across all projects, recency-first, top 8
  criticalCount: number;        // issues with priority === 'critical'
  highCount: number;            // issues with priority === 'high'

  // Page 1 — Attention Now
  dailyBrief: Issue[];          // cos latest (any status), top 4
  priorities: Issue[];          // radar+cos top by priority+recency, top 5
  interventions: Issue[];       // critical across all projects, executive-sorted top 4
  publicPulse: Issue[];         // voice all by exec-sort, top 5
  servicePainPoints: Issue[];   // friction all by exec-sort, top 5
  coordAlerts: Issue[];         // coordination high/critical exec-sort, top 4
  watchlist: Issue[];           // top medPlus items cross-project exec-sort, top 6

  // Page 2 — Decisions & Follow-Up
  decisionsRequired: Issue[];   // policy items, exec-sorted top 5
  policyInsights: Issue[];      // policy done (completed analysis), latest 4
  readinessItems: Issue[];      // all readiness items
  followUps: Issue[];           // cos items exec-sorted, top 6
  weeklyStats: WeeklyStats;
  escalations: Issue[];         // coordination critical exec-sorted top 4

  isLoading: boolean;
  isError: boolean;
  refetch: () => void;

  moduleHealth: ModuleHealth[];

  // Convenience
  projectLabels: typeof PROJECT_LABELS;
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useDashboardData(): DashboardData {
  const { data: allIssues = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['issues', 'all'],
    queryFn: () => fetchIssues({ limit: 500 }),
    staleTime: 60_000,
  });

  return useMemo<DashboardData>(() => {
    // ── project slices (include ALL statuses — hackathon data is all "done")
    const cos    = byProject(allIssues, 'cos');
    const radar  = byProject(allIssues, 'radar');
    const fric   = byProject(allIssues, 'friction');
    const voice  = byProject(allIssues, 'voice');
    const ready  = byProject(allIssues, 'readiness');
    const policy = byProject(allIssues, 'policy');
    const coord  = byProject(allIssues, 'coordination');

    // ── Executive overview
    const topIssues = latestFirst(allIssues.filter(visible)).slice(0, 10);
    const criticalCount = allIssues.filter(i => i.priority === 'critical').length;
    const highCount = allIssues.filter(i => i.priority === 'high').length;

    // ── Page 1
    // Daily brief: prefer active/pending cos, fall back to latest done
    const dailyBrief = sortExecutive(cos.filter(visible)).slice(0, 4);

    // Priorities: top radar+cos items, sorted by priority then recency
    const priorities = sortExecutive(
      [...radar, ...cos].filter(visible).filter(highPrio)
    ).slice(0, 5);

    // Interventions: critical items across ALL projects, exec-sorted
    const interventions = sortExecutive(
      allIssues.filter(visible).filter(i => i.priority === 'critical')
    ).slice(0, 5);

    // Public pulse: all voice items
    const publicPulse = sortExecutive(voice.filter(visible)).slice(0, 5);

    // Service pain points: all friction items
    const servicePainPoints = sortExecutive(fric.filter(visible)).slice(0, 5);

    // Coordination alerts: high/critical coordination items
    const coordAlerts = sortExecutive(
      coord.filter(visible).filter(highPrio)
    ).slice(0, 4);

    // Watchlist: top medPlus items from all projects, excluding those already shown
    const shownIds = new Set([
      ...priorities.map(i => i.id),
      ...interventions.map(i => i.id),
    ]);
    const watchlist = sortExecutive(
      allIssues.filter(i => visible(i) && medPlusPrio(i) && !shownIds.has(i.id))
    ).slice(0, 6);

    // ── Page 2
    // Decisions: policy items (prefer in_review/todo, then done as completed decisions)
    const decisionsRequired = sortExecutive(policy.filter(visible)).slice(0, 5);

    // Policy insights: done policy items sorted by recency
    const policyInsights = latestFirst(policy.filter(visible)).slice(0, 4);

    // Readiness items: all readiness items
    const readinessItems = sortExecutive(ready.filter(visible));

    // Follow-ups: cos items (prefer active, then recent done)
    const followUps = sortExecutive(cos.filter(visible)).slice(0, 6);

    // Weekly stats
    const keys: CapKey[] = ['cos', 'radar', 'friction', 'voice', 'readiness', 'policy', 'coordination'];
    const allVisible = allIssues.filter(visible);
    const weeklyStats: WeeklyStats = {
      total:   allVisible.length,
      done:    allVisible.filter(isDone).length,
      active:  allVisible.filter(isActive).length,
      pending: allVisible.filter(isPending).length,
      byModule: keys.map(key => {
        const slice = byProject(allVisible, key);
        return { key, en: PROJECT_LABELS[key].en, ar: PROJECT_LABELS[key].ar, done: slice.filter(isDone).length, total: slice.length };
      }),
    };

    // Escalations: critical coordination items
    const escalations = sortExecutive(
      coord.filter(visible).filter(i => i.priority === 'critical')
    ).slice(0, 4);

    // Module health: per-module severity for the status grid
    const moduleHealth: ModuleHealth[] = keys.map(key => {
      const slice = byProject(allVisible, key);
      return {
        key,
        en: PROJECT_LABELS[key].en,
        ar: PROJECT_LABELS[key].ar,
        total: slice.length,
        done: slice.filter(isDone).length,
        hasCritical: slice.some(i => i.priority === 'critical'),
        hasHigh: slice.some(i => i.priority === 'high'),
      };
    });

    return {
      topIssues, criticalCount, highCount,
      dailyBrief, priorities, interventions, publicPulse,
      servicePainPoints, coordAlerts, watchlist,
      decisionsRequired, policyInsights, readinessItems,
      followUps, weeklyStats, escalations,
      moduleHealth,
      isLoading, isError, refetch,
      projectLabels: PROJECT_LABELS,
    };
  }, [allIssues, isLoading, isError, refetch]);
}
