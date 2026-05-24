import type { Visit } from "../../types/visit";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate, fmtRating, fmtPrice } from "../../utils/formatters";
import { ImageWithSpinner } from "../ui/ImageWithSpinner";
import { visitsService } from "../../services/visits.service";
import { ResponsiveCardCarousel } from "../ui/ResponsiveCardCarousel";

type Props = {
  visit: Visit;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function VisitCard({ visit, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [details, setDetails] = useState<Visit | null>(
    visit.items !== undefined ? visit : null
  );
  const [fetching, setFetching] = useState(false);
  const [loadError, setLoadError] = useState("");
  const loadingDetails = fetching && !loadError;

  useEffect(() => {
    if (!open || details?.items !== undefined) {
      return;
    }

    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFetching(true);

    visitsService
      .get(visit.public_id)
      .then((loaded) => {
        if (!cancelled) {
          setDetails(loaded);
          setFetching(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(t("visitCard.loadError"));
          setFetching(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [details, open, t, visit.public_id]);

  const visibleItems = details?.items ?? visit.items ?? [];

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold">{fmtDate(visit.visited_at)}</p>
          {visit.would_return && (
            <span className="text-xs text-success font-medium">{t("visitCard.wouldReturn")} ✓</span>
          )}
        </div>
        {(onEdit || onDelete) && (
          <div className="flex gap-2 shrink-0">
            {onEdit && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onEdit}
                data-testid="visit-card-edit-button"
              >
                {t("visitCard.edit")}
              </Button>
            )}
            {onDelete && <Button size="sm" variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>{t("visitCard.delete")}</Button>}
          </div>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
        <span>{t("visitCard.overall")}: {fmtRating(visit.overall_rating)}</span>
        <span>{t("visitCard.environment")}: {fmtRating(visit.environment_rating)}</span>
        <span>{t("visitCard.service")}: {fmtRating(visit.service_rating)}</span>
      </div>
      {visit.general_notes && (
        <p className="mt-2 text-sm text-muted">{visit.general_notes}</p>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? t("visitCard.hideDetails") : t("visitCard.details")}
        </Button>
        {loadingDetails && <span className="text-xs text-muted">{t("common.loading")}</span>}
      </div>
      {loadError && <p className="mt-2 text-sm text-danger">{loadError}</p>}
      {open && visibleItems.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <ResponsiveCardCarousel
            ariaLabel={t("visitCard.details")}
            items={visibleItems}
            getKey={(item) => item.public_id}
            mobilePageSize={4}
            desktopPageSize={5}
            mobileColumns={2}
            desktopColumns={5}
            renderItem={(it) => (
              <div className="overflow-hidden rounded-xl border border-border bg-surface text-sm">
                {it.photo ? (
                  <button
                    type="button"
                    className="w-full cursor-zoom-in"
                    onClick={() => setLightboxSrc(it.photo!)}
                  >
                    <ImageWithSpinner
                      src={it.photo}
                      alt={it.name}
                      className="h-24 w-full object-cover"
                      spinnerClassName="rounded-none"
                    />
                  </button>
                ) : (
                  <div className="flex h-24 w-full items-center justify-center bg-muted/10 text-xs text-muted">
                    {t("visitCard.noPhoto")}
                  </div>
                )}
                <div className="space-y-0.5 p-2">
                  <p className="truncate font-medium">{it.name}</p>
                  <p className="text-xs text-muted">{t(`itemType.${it.type}`)}</p>
                  <p className="text-xs text-muted">{fmtRating(it.rating)} · {fmtPrice(it.price)}</p>
                  {it.notes && <p className="truncate text-xs text-muted">{it.notes}</p>}
                </div>
              </div>
            )}
          />
        </div>
      )}
      {open && !loadingDetails && !loadError && visibleItems.length === 0 && (
        <p className="mt-2 text-sm text-muted">{t("visitCard.empty")}</p>
      )}
      <Dialog open={Boolean(lightboxSrc)} onOpenChange={(o) => { if (!o) setLightboxSrc(null); }}>
        <DialogContent className="max-w-screen-sm p-0 overflow-hidden" aria-describedby={undefined}>
          {lightboxSrc && (
            <ImageWithSpinner
              src={lightboxSrc}
              alt=""
              className="w-full h-auto max-h-[90vh] object-contain"
              spinnerClassName="rounded-none"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("visitCard.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("visitCard.deleteConfirmMessage")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                onClick={() => { setDeleteConfirmOpen(false); onDelete?.(); }}
              >
                {t("visitCard.delete")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
