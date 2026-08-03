import { useMemo, useState } from "react";
import { format } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  "aria-label": string;
  value?: string;
  onChange: (value: string) => void;
};

export function DatePicker({ "aria-label": ariaLabel, value = "", onChange }: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => {
    const date = new Date(`${value}T00:00:00`);
    return value && !Number.isNaN(date.getTime()) ? date : undefined;
  }, [value]);
  const locale = i18n.language.startsWith("pt") ? ptBR : enUS;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="flex h-11 w-full items-center gap-3 border-[3px] border-input bg-background px-3 text-left text-sm font-bold shadow-[3px_3px_0_var(--color-shadow)] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <CalendarIcon className="size-4 shrink-0" />
          {selected ? format(selected, "dd/MM/yyyy", { locale }) : t("datePicker.placeholder")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto border-[3px] border-border bg-surface p-0 shadow-[6px_6px_0_var(--color-shadow)]">
        <Calendar mode="single" selected={selected} onSelect={(date) => {
          onChange(date ? format(date, "yyyy-MM-dd") : "");
          setOpen(false);
        }} locale={locale} />
        <div className="border-t-[3px] border-border p-2">
          <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => onChange("")}>
            {t("datePicker.clear")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
