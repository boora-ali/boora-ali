import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function LoadingSpinner({ className = "" }: Props) {
  return <Loader2 className={cn("animate-spin", className)} aria-hidden="true" />;
}
