import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DatePicker } from "../ui/DatePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PlaceFilters } from "../../services/places.service";
import { PLACE_STATUSES } from "../../utils/constants";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filters: PlaceFilters;
  onApply: (f: PlaceFilters) => void;
}

const ALL = "__all__";

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
        <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-5 space-y-4">
          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">{t("filters.status")}</label>
            <Controller control={form.control} name="status" render={({ field }) => (
              <Select value={field.value || ALL} onValueChange={(value) => field.onChange(value === ALL ? "" : value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ALL}>{t("places.all")}</SelectItem>{PLACE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{t(`status.${s.value}`)}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>

          {/* Min rating */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">{t("filters.min_rating")}</label>
            <Controller control={form.control} name="min_rating" render={({ field }) => (
              <Select value={field.value ? String(field.value) : ALL} onValueChange={(value) => field.onChange(value === ALL ? "" : Number(value))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ALL}>{t("filters.any")}</SelectItem>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>

          {/* Max rating */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">{t("filters.max_rating")}</label>
            <Controller control={form.control} name="max_rating" render={({ field }) => (
              <Select value={field.value ? String(field.value) : ALL} onValueChange={(value) => field.onChange(value === ALL ? "" : Number(value))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ALL}>{t("filters.any")}</SelectItem>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>

          {/* Date from */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">{t("filters.date_from")}</label>
            <Controller control={form.control} name="date_from" render={({ field }) => <DatePicker aria-label={t("filters.date_from")} value={field.value} onChange={field.onChange} />} />
          </div>

          {/* Date to */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text">{t("filters.date_to")}</label>
            <Controller control={form.control} name="date_to" render={({ field }) => <DatePicker aria-label={t("filters.date_to")} value={field.value} onChange={field.onChange} />} />
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
