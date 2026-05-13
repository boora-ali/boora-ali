import {
  Suspense,
  lazy,
  type ComponentType,
  type ReactNode,
  useSyncExternalStore,
} from "react";
import type { DotLottieReactProps } from "@lottiefiles/dotlottie-react";
import emptyPlacesAnimation from "../../assets/lottie/empty-places.json?url";
import emptyVisitsAnimation from "../../assets/lottie/empty-visits.json?url";
import loginPinAnimation from "../../assets/lottie/login-pin.json?url";
import mapResolvingAnimation from "../../assets/lottie/map-resolving.json?url";
import photoUploadingAnimation from "../../assets/lottie/photo-uploading.json?url";

const DotLottieReact = lazy(async () => {
  const module = await import("@lottiefiles/dotlottie-react");
  return { default: module.DotLottieReact as ComponentType<DotLottieReactProps> };
});

const animations = {
  "empty-places": emptyPlacesAnimation,
  "empty-visits": emptyVisitsAnimation,
  "login-pin": loginPinAnimation,
  "map-resolving": mapResolvingAnimation,
  "photo-uploading": photoUploadingAnimation,
} as const;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export type LottieStateName = keyof typeof animations;

type Props = {
  animation: LottieStateName;
  label: string;
  fallback?: ReactNode;
  className?: string;
};

function subscribeToReducedMotion(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

function StaticFallback({
  label,
  fallback,
  className,
}: {
  label: string;
  fallback: ReactNode;
  className: string;
}) {
  const fallbackClassName =
    typeof fallback === "string"
      ? `${className} flex items-center justify-center text-5xl opacity-30`
      : className;

  return (
    <div aria-label={label} role="img" className={fallbackClassName}>
      {fallback}
    </div>
  );
}

export function LottieState({
  animation,
  label,
  fallback = "🍽",
  className = "h-28 w-28",
}: Props) {
  const prefersReducedMotion = usePrefersReducedMotion();

  if (prefersReducedMotion) {
    return <StaticFallback label={label} fallback={fallback} className={className} />;
  }

  return (
    <Suspense fallback={<StaticFallback label={label} fallback={fallback} className={className} />}>
      <DotLottieReact
        src={animations[animation]}
        autoplay
        loop
        backgroundColor="transparent"
        aria-label={label}
        role="img"
        className={className}
      />
    </Suspense>
  );
}
