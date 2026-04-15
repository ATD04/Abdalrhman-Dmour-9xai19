import type { ReactNode } from 'react';

interface SectionBlockProps {
  labelEn: string;
  labelAr: string;
  isAr?: boolean;
  count?: number;
  children: ReactNode;
  className?: string;
}

export function SectionBlock({ labelEn, labelAr, isAr, count, children, className = '' }: SectionBlockProps) {
  return (
    <section className={`mb-8 ${className}`}>
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-twin-accent/80">
          {isAr ? labelAr : labelEn}
        </span>
        {count !== undefined && count > 0 && (
          <span className="text-[9px] font-bold bg-twin-accent/15 text-twin-accent/90 px-1.5 py-0.5 rounded-full tabular-nums">
            {count}
          </span>
        )}
        <div className="flex-1 h-px bg-twin-border" />
      </div>
      {children}
    </section>
  );
}
