export function LoadingState() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-surface rounded-2xl border border-border overflow-hidden animate-pulse"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="h-44 bg-border/60" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-border/60 rounded-full w-3/4" />
            <div className="h-3 bg-border/40 rounded-full w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
