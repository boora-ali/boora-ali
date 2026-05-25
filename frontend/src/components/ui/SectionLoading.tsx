import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  message: string;
  className?: string;
  messageClassName?: string;
  spinnerClassName?: string;
};

export function SectionLoading({
  message,
  className = "",
  messageClassName = "",
  spinnerClassName = "",
}: Props) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <Loader2
        className={cn("h-4 w-4 animate-spin text-primary", spinnerClassName)}
        aria-hidden="true"
      />
      <span className={cn("text-sm text-muted", messageClassName)}>{message}</span>
    </div>
  );
}
