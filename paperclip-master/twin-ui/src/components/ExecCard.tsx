import type { ReactNode } from 'react';
import { getSeverityStyles } from './SeverityChip';
import type { Severity } from './SeverityChip';

interface ExecCardProps {
  title: string;
  severity?: Severity;
  chip?: ReactNode;
  className?: string;
  onClick?: () => void;
  meta?: string;    // project / date label
  snippet?: string; // brief description excerpt
}

export function ExecCard({
  title, severity = 'neutral', chip, className = '', onClick, meta, snippet,
}: ExecCardProps) {
  const bar = getSeverityStyles(severity).bar;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      className={`relative w-full text-start bg-twin-card border border-twin-border rounded-xl overflow-hidden flex flex-col transition-colors hover:border-twin-border-mid hover:bg-twin-hover ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Severity strip on inline-start */}
      <div className={`absolute inset-y-0 start-0 w-[3px] ${bar}`} />

      <div className="ps-5 pe-4 pt-3.5 pb-3 flex flex-col gap-1">
        <div className="flex items-start gap-3">
          <p className="text-sm font-semibold text-twin-text leading-snug flex-1">
            {title}
          </p>
          {chip && <div className="shrink-0 mt-0.5">{chip}</div>}
        </div>
        {snippet && (
          <p className="text-xs text-twin-text-3 leading-relaxed line-clamp-2">{snippet}</p>
        )}
        {meta && (
          <p className="text-[10px] text-twin-text-3 font-medium uppercase tracking-wider mt-0.5">{meta}</p>
        )}
      </div>
    </Tag>
  );
}

// ─── Compact list item variant ────────────────────────────────────────────────

interface ExecListItemProps {
  title: string;
  severity?: Severity;
  chip?: ReactNode;
  onClick?: () => void;
}

export function ExecListItem({ title, severity = 'neutral', chip, onClick }: ExecListItemProps) {
  const dot = getSeverityStyles(severity).dot;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`w-full text-start flex items-center gap-3 px-4 py-3 border-b border-twin-border last:border-0 hover:bg-twin-hover transition-colors ${onClick ? 'cursor-pointer' : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span className="text-sm text-twin-text flex-1 leading-snug line-clamp-1">{title}</span>
      {chip && <div className="shrink-0">{chip}</div>}
    </Tag>
  );
}
