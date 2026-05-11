type PaginationDotsProps = {
  count: number;
  current: number;
  onChange: (index: number) => void;
  ariaLabel?: string;
};

export function PaginationDots({ count, current, onChange, ariaLabel }: PaginationDotsProps) {
  if (count <= 1) return null;

  return (
    <div
      className="flex items-center justify-center gap-2"
      role="tablist"
      aria-label={ariaLabel}
    >
      {Array.from({ length: count }, (_, index) => {
        const isActive = current === index;
        return (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`Page ${index + 1}`}
            onClick={() => onChange(index)}
            className={`h-2.5 rounded-full transition-all ${
              isActive
                ? "w-7 bg-primary"
                : "w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
            }`}
          />
        );
      })}
    </div>
  );
}
