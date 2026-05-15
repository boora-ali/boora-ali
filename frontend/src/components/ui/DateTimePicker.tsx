import { useMemo } from "react";
import { format, set } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function DateTimePicker({ label, value, onChange, error }: Props) {
  const { t, i18n } = useTranslation();
  const selected = useMemo(() => {
    if (!value) return undefined;
    const next = new Date(value);
    return Number.isNaN(next.getTime()) ? undefined : next;
  }, [value]);
  const locale = i18n.language.startsWith("pt") ? ptBR : enUS;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function emitDate(next?: Date) {
    onChange(next ? next.toISOString() : "");
  }

  function handleDateSelect(next?: Date) {
    if (!next) {
      emitDate(undefined);
      return;
    }

    const base = selected ?? new Date();
    emitDate(
      set(next, {
        hours: base.getHours(),
        minutes: base.getMinutes(),
        seconds: 0,
        milliseconds: 0,
      })
    );
  }

  function handleTimeChange(nextValue: string) {
    const [hoursText = "0", minutesText = "0"] = nextValue.split(":");
    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return;

    const base = selected ?? new Date();
    emitDate(
      set(base, {
        hours,
        minutes,
        seconds: 0,
        milliseconds: 0,
      })
    );
  }

  return (
    <div className="space-y-1">
      {label && <Label className="block">{label}</Label>}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-11 w-full items-center gap-3 rounded-xl border border-input bg-background px-3.5 py-2.5 text-left text-base ring-offset-background transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm",
              !selected && "text-muted-foreground",
              error && "border-destructive focus-visible:ring-destructive"
            )}
          >
            <CalendarIcon className="size-4 shrink-0 opacity-70" />
            <span className="truncate">
              {selected ? format(selected, "dd/MM/yyyy HH:mm", { locale }) : t("dateTimePicker.placeholder")}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto rounded-xl border-border p-0">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleDateSelect}
            locale={locale}
            timeZone={timeZone}
            captionLayout="dropdown"
            startMonth={new Date(2000, 0)}
            endMonth={new Date(2100, 11)}
          />
          <div className="border-border border-t p-3">
            <Label className="mb-2 block">
              {t("dateTimePicker.timeCaption")}
            </Label>
            <Input
              type="time"
              step={900}
              value={selected ? format(selected, "HH:mm") : ""}
              onChange={(event) => handleTimeChange(event.target.value)}
            />
          </div>
        </PopoverContent>
      </Popover>
      {error && <span className="text-danger text-xs mt-1 block">{error}</span>}
    </div>
  );
}
