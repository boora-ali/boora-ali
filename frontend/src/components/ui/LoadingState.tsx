export function LoadingState({ variant = "cards" }: { variant?: "cards" | "detail" }) {
  if (variant === "detail") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <div className="h-10 w-24 rounded-full skeleton-shimmer" />
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="h-56 skeleton-shimmer sm:h-72" />
          <div className="flex flex-col gap-3 p-4">
            <div className="h-7 w-2/3 rounded-full skeleton-shimmer" />
            <div className="h-4 w-1/3 rounded-full skeleton-shimmer" style={{ animationDelay: "100ms" }} />
            <div className="h-10 w-full rounded-lg skeleton-shimmer" style={{ animationDelay: "200ms" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-surface rounded-2xl border border-border overflow-hidden"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="h-44 skeleton-shimmer" style={{ animationDelay: `${i * 60}ms` }} />
          <div className="p-4 space-y-2.5">
            <div className="h-4 skeleton-shimmer rounded-full w-3/4" style={{ animationDelay: `${i * 60 + 80}ms` }} />
            <div className="h-3 skeleton-shimmer rounded-full w-1/2" style={{ animationDelay: `${i * 60 + 160}ms` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
