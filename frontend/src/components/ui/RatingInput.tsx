type Props = {
  label?: string;
  value: number;
  onChange: (n: number) => void;
  error?: string;
};

export function RatingInput({ label, value, onChange, error }: Props) {
  const id = label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <label className="block" htmlFor={id}>
      {label && <span className="block text-sm font-medium mb-1">{label}</span>}
      <input
        id={id}
        type="number"
        min={0}
        max={10}
        step={0.1}
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isNaN(n) || n < 0 || n > 10) return;
          onChange(n);
        }}
        className="w-full rounded-xl border border-border bg-background text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {error && <span className="text-danger text-xs mt-1 block">{error}</span>}
    </label>
  );
}
