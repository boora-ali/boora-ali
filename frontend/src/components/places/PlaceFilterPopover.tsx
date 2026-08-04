import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "../ui/DatePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PlaceFilters } from "../../services/places.service";
import { PLACE_STATUSES } from "../../utils/constants";

interface Props {
  filters: PlaceFilters;
  onApply: (f: PlaceFilters) => void;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
}

const labelClass = "block text-xs font-medium text-muted mb-1";
const ALL = "__all__";

export function PlaceFilterPopover({ filters, onApply, search, onSearchChange, searchPlaceholder }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const form = useForm<PlaceFilters>({ defaultValues: filters });

  const activeCount = Object.values(filters).filter((v) => v !== undefined && v !== "" && v !== null).length;

  function handleSubmit(data: PlaceFilters) {
    const clean = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== "" && v !== undefined && v !== null && !Number.isNaN(v))
    ) as PlaceFilters;
    onApply(clean);
    setOpen(false);
  }

  function handleClear() {
    form.reset({});
    onApply({});
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* Search input wrapper */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full border-[3px] border-border bg-surface px-4 py-2.5 pr-12 text-sm font-bold text-text shadow-[4px_4px_0_currentColor] placeholder:text-muted focus:outline-[3px] focus:outline-offset-2 focus:outline-primary"
        />

        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={t("filters.title")}
            className={`absolute right-2 flex h-8 w-8 items-center justify-center border-[3px] border-border shadow-[2px_2px_0_currentColor] transition-[transform,box-shadow,background-color,color] duration-150 focus:outline-[3px] focus:outline-offset-2 focus:outline-primary
              ${open
                ? "bg-primary text-white"
                : activeCount > 0
                  ? "bg-primary/15 text-primary"
                  : "text-muted hover:bg-muted/20 hover:text-text"
              }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeCount > 0 && !open && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center border-2 border-border bg-primary text-[9px] font-bold text-white leading-none">
                {activeCount}
              </span>
            )}
          </button>
        </Popover.Trigger>
      </div>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 border-[3px] border-border bg-surface shadow-[6px_6px_0_currentColor] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-text">{t("filters.title")}</span>
            <Popover.Close asChild>
              <button className="border-2 border-transparent p-0.5 text-muted hover:border-border hover:text-text focus:outline-[3px] focus:outline-offset-2 focus:outline-primary">
                <X className="h-4 w-4" />
              </button>
            </Popover.Close>
          </div>

          {/* Form */}
          <form onSubmit={form.handleSubmit(handleSubmit)} className="p-3 space-y-3">
            <div>
              <label className={labelClass}>{t("filters.status")}</label>
              <Controller control={form.control} name="status" render={({ field }) => (
                <Select value={field.value || ALL} onValueChange={(value) => field.onChange(value === ALL ? "" : value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("places.all")}</SelectItem>
                    {PLACE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{t(`status.${s.value}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("filters.min_rating")}</label>
                <Controller control={form.control} name="min_rating" render={({ field }) => (
                  <Select value={field.value ? String(field.value) : ALL} onValueChange={(value) => field.onChange(value === ALL ? "" : Number(value))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={ALL}>{t("filters.any")}</SelectItem>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <label className={labelClass}>{t("filters.max_rating")}</label>
                <Controller control={form.control} name="max_rating" render={({ field }) => (
                  <Select value={field.value ? String(field.value) : ALL} onValueChange={(value) => field.onChange(value === ALL ? "" : Number(value))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={ALL}>{t("filters.any")}</SelectItem>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
            </div>

            <div>
              <label className={labelClass}>{t("filters.date_from")}</label>
              <Controller control={form.control} name="date_from" render={({ field }) => <DatePicker aria-label={t("filters.date_from")} value={field.value} onChange={field.onChange} />} />
            </div>

            <div>
              <label className={labelClass}>{t("filters.date_to")}</label>
              <Controller control={form.control} name="date_to" render={({ field }) => <DatePicker aria-label={t("filters.date_to")} value={field.value} onChange={field.onChange} />} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" className="flex-1">
                {t("filters.apply")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleClear} className="flex-1">
                {t("filters.clear")}
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
