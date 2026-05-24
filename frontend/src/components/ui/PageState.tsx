import type { ReactNode } from "react";
import type { LottieStateName } from "./LottieState";
import { LoadingState } from "./LoadingState";
import { EmptyState } from "./EmptyState";
import { ErrorMessage } from "./ErrorMessage";

type Props = {
  loading: boolean;
  error?: string;
  empty?: boolean;
  loadingVariant?: "cards" | "detail";
  loadingNode?: ReactNode;
  errorNode?: ReactNode;
  emptyNode?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  emptyAnimation?: LottieStateName;
  children?: ReactNode;
};

export function PageState({
  loading,
  error = "",
  empty = false,
  loadingVariant = "cards",
  loadingNode,
  errorNode,
  emptyNode,
  emptyTitle = "",
  emptyDescription,
  emptyAction,
  emptyAnimation,
  children,
}: Props) {
  if (loading) {
    return loadingNode ?? <LoadingState variant={loadingVariant} />;
  }

  if (error) {
    return errorNode ?? <ErrorMessage message={error} />;
  }

  if (empty) {
    return (
      emptyNode ?? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
          animation={emptyAnimation}
        />
      )
    );
  }

  return children ?? null;
}
