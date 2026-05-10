import { cn } from "@/lib/utils";

type Props = {
  value?: string | number | null;
  max: number;
  className?: string;
};

export function CharacterCount({ value, max, className }: Props) {
  const length = String(value ?? "").length;
  const nearLimit = length >= Math.floor(max * 0.9);

  return (
    <p
      className={cn(
        "text-right text-xs tabular-nums text-muted-foreground",
        nearLimit && "font-medium text-primary",
        length > max && "text-destructive",
        className,
      )}
      aria-live="polite"
    >
      {length}/{max}
    </p>
  );
}
