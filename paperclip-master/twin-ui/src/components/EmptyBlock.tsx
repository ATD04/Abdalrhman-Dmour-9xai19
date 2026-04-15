interface EmptyBlockProps {
  messageEn: string;
  messageAr: string;
  isAr?: boolean;
  compact?: boolean;
}

export function EmptyBlock({ messageEn, messageAr, isAr, compact }: EmptyBlockProps) {
  return (
    <div
      className={`flex items-center justify-center ${compact ? 'p-4' : 'p-8'} bg-twin-card border border-dashed border-twin-border rounded-xl`}
    >
      <p className="text-sm text-slate-600">{isAr ? messageAr : messageEn}</p>
    </div>
  );
}
