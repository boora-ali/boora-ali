import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlaceFilters } from "../../services/places.service";
import { PLACE_STATUSES } from "../../utils/constants";

interface Props {
  filters: PlaceFilters;
  onApply: (f: PlaceFilters) => void;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
}

const selectClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "block text-xs font-medium text-muted mb-1";

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
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 pr-12 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />

        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={t("filters.title")}
            className={`absolute right-2 flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150 focus:outline-none
              ${open
                ? "bg-primary text-white"
                : activeCount > 0
                  ? "bg-primary/15 text-primary"
                  : "text-muted hover:bg-muted/20 hover:text-text"
              }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeCount > 0 && !open && (
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white leading-none">
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
          className="z-50 w-72 rounded-2xl border border-border bg-surface shadow-lg shadow-black/10 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-text">{t("filters.title")}</span>
            <Popover.Close asChild>
              <button className="rounded-md p-0.5 text-muted hover:text-text transition-colors focus:outline-none">
                <X className="h-4 w-4" />
              </button>
            </Popover.Close>
          </div>

          {/* Form */}
          <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">
            <div>
              <label className={labelClass}>{t("filters.status")}</label>
              <select {...form.register("status")} className={selectClass}>
                <option value="">{t("places.all")}</option>
                {PLACE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(`status.${s.value}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("filters.min_rating")}</label>
                <select {...form.register("min_rating", { valueAsNumber: true })} className={selectClass}>
                  <option value="">{t("filters.any")}</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("filters.max_rating")}</label>
                <select {...form.register("max_rating", { valueAsNumber: true })} className={selectClass}>
                  <option value="">{t("filters.any")}</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>{t("filters.date_from")}</label>
              <input
                type="date"
                {...form.register("date_from")}
                className={selectClass}
              />
            </div>

            <div>
              <label className={labelClass}>{t("filters.date_to")}</label>
              <input
                type="date"
                {...form.register("date_to")}
                className={selectClass}
              />
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
