import { startTransition, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { placesService, type Page } from "../services/places.service";
import type { Place } from "../types/place";
import { BackButton } from "../components/ui/BackButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { notifyPlacesChanged } from "../utils/places-state";

function fmtDeletedAt(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === "pt-BR" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function TrashPage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<Page<Place> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Place | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    startTransition(() => { setLoading(true); });
    placesService
      .trash({ page })
      .then((d) => { setData(d); setError(""); })
      .catch(() => setError(t("trash.error")))
      .finally(() => setLoading(false));
  }, [page, t]);

  async function handleRestore(publicId: string) {
    setRestoring(publicId);
    try {
      await placesService.restore(publicId);
      notifyPlacesChanged();
      setData((prev) =>
        prev
          ? { ...prev, count: prev.count - 1, results: prev.results.filter((p) => p.public_id !== publicId) }
          : prev
      );
    } finally {
      setRestoring(null);
    }
  }

  async function handlePermanentDelete() {
    if (!permanentDeleteTarget) return;
    setDeleting(true);
    try {
      await placesService.permanentDelete(permanentDeleteTarget.public_id);
      notifyPlacesChanged();
      setData((prev) =>
        prev
          ? { ...prev, count: prev.count - 1, results: prev.results.filter((p) => p.public_id !== permanentDeleteTarget.public_id) }
          : prev
      );
      setPermanentDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <BackButton fallbackTo="/places" />

      <div>
        <h1 className="font-fraunces text-3xl font-bold text-text leading-none">{t("trash.title")}</h1>
        <p className="text-muted text-sm mt-1">{t("trash.subtitle")}</p>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorMessage message={error} />}
      {!loading && !error && data?.count === 0 && (
        <EmptyState title={t("trash.empty.title")} description={t("trash.empty.description")} />
      )}

      {!loading && !error && data && data.count > 0 && (
        <div className="space-y-3">
          {data.results.map((place) => (
            <div
              key={place.public_id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text truncate">{place.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  {place.category}
                  {place.deleted_at && (
                    <> &middot; {t("trash.deletedAt", { date: fmtDeletedAt(place.deleted_at, i18n.language) })}</>
                  )}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleRestore(place.public_id)}
                  disabled={restoring === place.public_id}
                >
                  {restoring === place.public_id ? t("trash.restoring") : t("trash.restore")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setPermanentDeleteTarget(place)}
                  disabled={restoring === place.public_id}
                >
                  {t("trash.permanentDelete")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (data.next || data.previous) && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button variant="secondary" disabled={!data.previous} onClick={() => setPage((n) => n - 1)}>
            {t("places.previous")}
          </Button>
          <span className="text-muted text-sm">{t("places.page", { page })}</span>
          <Button variant="secondary" disabled={!data.next} onClick={() => setPage((n) => n + 1)}>
            {t("places.next")}
          </Button>
        </div>
      )}

      <Dialog
        open={Boolean(permanentDeleteTarget)}
        onOpenChange={(o) => { if (!o) setPermanentDeleteTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("trash.permanentDeleteTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("trash.permanentDeleteMessage")}</p>
            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setPermanentDeleteTarget(null)}
                disabled={deleting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handlePermanentDelete}
                disabled={deleting}
              >
                {deleting ? t("trash.permanentDeleting") : t("trash.permanentDelete")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
