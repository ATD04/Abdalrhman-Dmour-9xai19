export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-twin-card border border-twin-border rounded-xl p-4 animate-pulse ${className}`}>
      <div className="h-3 bg-twin-border rounded w-3/4 mb-2" />
      <div className="h-2.5 bg-twin-border rounded w-full mb-1" />
      <div className="h-2.5 bg-twin-border rounded w-2/3" />
    </div>
  );
}

export function CardSkeletonGrid({ count = 4, cols = 2 }: { count?: number; cols?: number }) {
  return (
    <div className={`grid gap-3 ${cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
      {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="bg-twin-card border border-twin-border rounded-xl overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-twin-border last:border-0 animate-pulse">
          <div className="w-1.5 h-1.5 rounded-full bg-twin-border shrink-0" />
          <div className="h-2.5 bg-twin-border rounded flex-1" />
          <div className="h-2.5 bg-twin-border rounded w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function BriefSkeleton() {
  return (
    <div className="bg-twin-accent/5 border border-twin-accent/15 rounded-2xl p-5 animate-pulse">
      <div className="h-3 bg-twin-accent/15 rounded w-24 mb-4" />
      {[0.9, 0.7, 0.8, 0.6].map((w, i) => (
        <div key={i} className="flex items-start gap-2 mb-2">
          <div className="w-1 h-1 rounded-full bg-twin-accent/30 mt-1 shrink-0" />
          <div className="h-3 bg-twin-card rounded flex-1" style={{ width: `${w * 100}%` }} />
        </div>
      ))}
    </div>
  );
}
