import { Slider } from "@/components/ui/slider";

type Props = {
  label?: string;
  value: number;
  onChange: (n: number) => void;
  error?: string;
};

export function RatingInput({ label, value, onChange, error }: Props) {
  const id = label?.toLowerCase().replace(/\s+/g, "-");
  const displayValue = Number.isFinite(value) ? value : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        {label && <span className="text-sm font-medium">{label}</span>}
        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-text">
          {displayValue}/10
        </span>
      </div>
      <Slider
        id={id}
        min={0}
        max={10}
        step={1}
        value={[displayValue]}
        onValueChange={([nextValue]) => onChange(nextValue ?? 0)}
        aria-label={label}
      />
      {error && <span className="text-danger text-xs mt-1 block">{error}</span>}
    </div>
  );
}
