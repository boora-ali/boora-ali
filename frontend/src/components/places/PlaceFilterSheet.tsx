import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { PlaceFilters } from "../../services/places.service";
import { PLACE_STATUSES } from "../../utils/constants";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filters: PlaceFilters;
  onApply: (f: PlaceFilters) => void;
}

export function PlaceFilterSheet({ open, onOpenChange, filters, onApply }: Props) {
  const { t } = useTranslation();
  const form = useForm<PlaceFilters>({ defaultValues: filters });

  function handleSubmit(data: PlaceFilters) {
    // Strip empty strings and undefined
    const clean: PlaceFilters = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== "" && v !== undefined && v !== null && !Number.isNaN(v))
    ) as PlaceFilters;
    onApply(clean);
    onOpenChange(false);
  }

  function handleClear() {
    form.reset({});
    onApply({});
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("filters.title")}</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-6 space-y-5">
          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">{t("filters.status")}</label>
            <select
              {...form.register("status")}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text"
            >
              <option value="">{t("places.all")}</option>
              {PLACE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {t(`status.${s.value}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Min rating */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">{t("filters.min_rating")}</label>
            <select
              {...form.register("min_rating", { valueAsNumber: true })}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text"
            >
              <option value="">{t("filters.any")}</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Max rating */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">{t("filters.max_rating")}</label>
            <select
              {...form.register("max_rating", { valueAsNumber: true })}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text"
            >
              <option value="">{t("filters.any")}</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">{t("filters.date_from")}</label>
            <input
              type="date"
              {...form.register("date_from")}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </div>

          {/* Date to */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">{t("filters.date_to")}</label>
            <input
              type="date"
              {...form.register("date_to")}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" className="w-full">{t("filters.apply")}</Button>
            <Button type="button" variant="ghost" className="w-full" onClick={handleClear}>
              {t("filters.clear")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
