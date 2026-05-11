import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center animate-fade-in">
      <div className="text-5xl mb-4 opacity-30">🍽</div>
      <div>
        <h3 className="font-fraunces text-xl font-semibold text-text">{title}</h3>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
