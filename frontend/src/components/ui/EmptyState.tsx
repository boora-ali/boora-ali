import type { ReactNode } from "react";
import { LottieState, type LottieStateName } from "./LottieState";

export function EmptyState({
  title,
  description,
  action,
  animation = "empty-places",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  animation?: LottieStateName;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center animate-fade-in">
      <LottieState
        animation={animation}
        label={title}
        className="h-40 w-40 scale-125"
      />
      <div>
        <h3 className="font-fraunces text-xl font-semibold text-text">{title}</h3>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
