import type { IssuePriority, IssueStatus } from '../types';

export type Severity = 'urgent' | 'attention' | 'monitor' | 'good' | 'neutral';

const SEVERITY_STYLES: Record<Severity, { pill: string; bar: string; dot: string }> = {
  urgent:    { pill: 'border-red-700/60 text-red-400 bg-red-950/25',          bar: 'bg-red-600',    dot: 'bg-red-400'    },
  attention: { pill: 'border-zinc-500/40 text-zinc-100 bg-zinc-800/40',        bar: 'bg-zinc-300',   dot: 'bg-zinc-200'   },
  monitor:   { pill: 'border-zinc-700/40 text-zinc-400 bg-transparent',        bar: 'bg-zinc-600',   dot: 'bg-zinc-500'   },
  good:      { pill: 'border-emerald-800/50 text-emerald-400 bg-transparent',  bar: 'bg-emerald-700',dot: 'bg-emerald-400'},
  neutral:   { pill: 'border-twin-border text-twin-text-3 bg-transparent',     bar: 'bg-twin-border',dot: 'bg-twin-border' },
};

export function priorityToSeverity(p: IssuePriority): Severity {
  if (p === 'critical') return 'urgent';
  if (p === 'high')     return 'attention';
  if (p === 'medium')   return 'monitor';
  return 'neutral';
}

export function statusToSeverity(s: IssueStatus): Severity {
  if (s === 'done')        return 'good';
  if (s === 'in_progress') return 'monitor';
  if (s === 'in_review')   return 'attention';
  return 'neutral';
}

export function getSeverityStyles(sev: Severity) {
  return SEVERITY_STYLES[sev];
}

interface SeverityChipProps {
  severity: Severity;
  labelEn: string;
  labelAr: string;
  isAr?: boolean;
  small?: boolean;
}

export function SeverityChip({ severity, labelEn, labelAr, isAr, small }: SeverityChipProps) {
  const styles = SEVERITY_STYLES[severity];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-full font-semibold ${styles.pill} ${
        small ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
      }`}
    >
      <span className={`rounded-full shrink-0 ${styles.dot} ${small ? 'w-1.5 h-1.5' : 'w-2 h-2'}`} />
      {isAr ? labelAr : labelEn}
    </span>
  );
}
