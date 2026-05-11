export function LoadingState({ variant = "cards" }: { variant?: "cards" | "detail" }) {
  if (variant === "detail") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <div className="h-10 w-24 animate-pulse rounded-full bg-border/50" />
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="h-56 animate-pulse bg-border/60 sm:h-72" />
          <div className="flex flex-col gap-3 p-4">
            <div className="h-7 w-2/3 animate-pulse rounded-full bg-border/60" />
            <div className="h-4 w-1/3 animate-pulse rounded-full bg-border/50" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-border/40" />
          </div>
        </div>
      </div>
    );
  }

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
