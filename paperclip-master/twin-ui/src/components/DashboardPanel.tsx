import type { ReactNode } from 'react';
import { useLang } from '../context/LangContext';

interface DashboardPanelProps {
  /** English panel label */
  label: string;
  /** Arabic panel label */
  labelAr?: string;
  /** Item count badge */
  count?: number;
  /** Extra element shown in the header row (right side) */
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Skip internal padding — for full-bleed grids */
  noPadding?: boolean;
}

export function DashboardPanel({
  label, labelAr, count, headerRight, children, className = '', noPadding,
}: DashboardPanelProps) {
  const { isAr } = useLang();
  const displayLabel = isAr && labelAr ? labelAr : label;

  const now = new Date().toLocaleTimeString(isAr ? 'ar-JO' : 'en-GB', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className={`flex flex-col bg-twin-card border border-twin-border rounded-xl overflow-hidden ${className}`}>
      {/* Header ─────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-twin-border shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-twin-text tracking-widest uppercase">
            {displayLabel}
          </span>
          {count !== undefined && count > 0 && (
            <span className="text-[10px] font-bold text-twin-text-3 border border-twin-border px-1.5 py-0.5 rounded-full tabular-nums">
              {count}
            </span>
          )}
        </div>
        {headerRight ?? (
          <span className="text-twin-text-3 text-sm leading-none select-none">···</span>
        )}
      </div>

      {/* Body ───────────────────────────────── */}
      <div className={`flex-1 ${noPadding ? '' : 'p-4'}`}>
        {children}
      </div>

      {/* Footer ─────────────────────────────── */}
      <div className="flex items-center justify-end px-4 py-1.5 border-t border-twin-border shrink-0">
        <span className="text-[10px] text-twin-text-3 tabular-nums">{now}</span>
      </div>
    </div>
  );
}
