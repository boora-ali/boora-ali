import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { placesService, type PlaceWithVisits } from "../services/places.service";
import { visitsService } from "../services/visits.service";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "../components/ui/Badge";
import { LoadingState } from "../components/ui/LoadingState";
import { VisitCard } from "../components/visits/VisitCard";
import { BackButton } from "../components/ui/BackButton";
import { MapModal } from "../components/ui/MapModal";
import { fmtPrice, fmtRating } from "../utils/formatters";
import { sanitizeUrl } from "../utils/url";
import { notifyPlacesChanged } from "../utils/places-state";
import NotFoundPage from "./NotFoundPage";

const COORDS_POLL_INTERVAL_MS = 1000;

export default function PlaceDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const nav = useNavigate();
  const [place, setPlace] = useState<PlaceWithVisits | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    placesService.get(id!).then((loadedPlace) => {
      if (!cancelled) {
        setPlace(loadedPlace);
      }
    }).catch((error) => {
      if (error.isNotFound) {
        setNotFound(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || place?.coords_status !== "pending") return;

    const interval = window.setInterval(() => {
      placesService.get(id).then((loadedPlace) => {
        setPlace(loadedPlace);
        if (loadedPlace.coords_status && loadedPlace.coords_status !== "pending") {
          notifyPlacesChanged();
        }
      }).catch((error) => {
        if (error.isNotFound) {
          setNotFound(true);
        }
      });
    }, COORDS_POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [id, place?.coords_status]);

  if (notFound) {
    return <NotFoundPage />;
  }

  if (!place) return <LoadingState />;

  const hasConsumables = place.consumables_count > 0;
  const coordsStatus =
    place.coords_status ??
    (place.latitude && place.longitude ? "resolved" : place.maps_url ? "pending" : "resolved");
  const hasCoordinates = Boolean(place.latitude && place.longitude);
  const canOpenMap = coordsStatus === "resolved" && hasCoordinates;
  const mapsUrl = sanitizeUrl(place.maps_url);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <BackButton />
      <Card>
        <CardContent className="pt-4 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-bold leading-tight">{place.name}</h1>
            <p className="mt-1 text-sm text-muted">{place.category}</p>
            <div className="mt-2">
              <Badge status={place.status} />
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[250px]">
            <Link
              to={`/places/${place.public_id}/edit`}
              className="w-full"
              data-testid="place-detail-edit-link"
            >
              <Button
                variant="secondary"
                size="sm"
                className="w-full gap-1.5"
                data-testid="place-detail-edit-button"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.1 2.1 0 112.971 2.971L8.438 17.853 4 19l1.147-4.438L16.862 3.487z" />
                </svg>
                {t("placeDetail.edit")}
              </Button>
            </Link>
            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.5l-1.05 10.73A2.25 2.25 0 0116.21 20.25H7.79a2.25 2.25 0 01-2.24-2.02L4.5 7.5m3-3h9m-7.5 0V3.75A.75.75 0 019.75 3h4.5a.75.75 0 01.75.75V4.5m-9.75 3h13.5" />
              </svg>
              {t("placeDetail.delete")}
            </Button>
          </div>
        </div>

        {(place.address || place.instagram_url || place.maps_url || (place.latitude && place.longitude)) && (
          <div className="space-y-3 rounded-xl border border-border bg-background/60 p-3">
            {place.address && (
              <div className="flex items-start gap-2 text-sm text-muted">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 flex-shrink-0 fill-none stroke-current stroke-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7.5-4.108 7.5-11.25a7.5 7.5 0 10-15 0C4.5 16.892 12 21 12 21z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
                <span>{place.address}</span>
            </div>
          )}

          {coordsStatus !== "resolved" && (
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                coordsStatus === "pending"
                  ? "border-sky-200 bg-sky-50 text-sky-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              {coordsStatus === "pending"
                ? t("placeDetail.coordsPending")
                : t("placeDetail.coordsFailed")}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {sanitizeUrl(place.instagram_url) && (
              <a
                href={sanitizeUrl(place.instagram_url)}
                target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text transition hover:bg-background"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
                    <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="4.5" />
                    <circle cx="12" cy="12" r="3.5" />
                    <circle cx="17.5" cy="6.5" r="0.75" />
                  </svg>
                  {t("placeDetail.instagram")}
                </a>
              )}

              {canOpenMap && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setMapOpen(true);
                  }}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  {t("placeDetail.maps")}
                </Button>
              )}

              {mapsUrl && !canOpenMap && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text transition hover:bg-background"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75L3.75 9.75l5.25 3 5.25-3L9 6.75zM3.75 9.75v6l5.25 3m0-6v6m0-6l5.25-3m-5.25 9l5.25-3v-6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 9.75v6l-5.25 3" />
                  </svg>
                  {t("placeDetail.maps")}
                </a>
              )}
            </div>
          </div>
        )}

        {place.notes && (
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-sm leading-relaxed text-text">{place.notes}</p>
          </div>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
        <h2 className="text-lg font-semibold">{t("placeDetail.consumables.title")}</h2>
        {hasConsumables ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-muted">{t("placeDetail.consumables.items")}</p>
              <p className="text-xl font-semibold">{place.consumables_count}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted">{t("placeDetail.consumables.avgRating")}</p>
              <p className="text-xl font-semibold">
                {place.average_consumable_rating == null
                  ? t("common.na")
                  : fmtRating(place.average_consumable_rating)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted">{t("placeDetail.consumables.totalSpent")}</p>
              <p className="text-xl font-semibold">
                {place.total_consumed_amount == null
                  ? t("common.na")
                  : fmtPrice(place.total_consumed_amount)}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("placeDetail.consumables.empty")}</p>
        )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">
          {t("placeDetail.visits.title", { count: place.visits.length })}
        </h2>
        <Link to={`/places/${place.public_id}/visits/new`} className="w-full sm:w-auto">
          <Button size="sm" className="w-full sm:w-auto">{t("placeDetail.visits.add")}</Button>
        </Link>
      </div>

      {place.visits.length === 0 ? (
        <p className="text-muted text-sm text-center py-6">{t("placeDetail.visits.empty")}</p>
      ) : (
        place.visits.map((v) => (
          <VisitCard
            key={v.public_id}
            visit={v}
            onEdit={() => nav(`/visits/${v.public_id}/edit`, { state: { visit: v } })}
            onDelete={async () => {
              await visitsService.remove(v.public_id);
              setPlace({ ...place, visits: place.visits.filter((x) => x.public_id !== v.public_id) });
            }}
          />
        ))
      )}

      {canOpenMap && (
        <MapModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          name={place.name}
          latitude={place.latitude ?? ""}
          longitude={place.longitude ?? ""}
          mapsUrl={place.maps_url}
        />
      )}

      <Dialog open={deleteConfirmOpen} onOpenChange={(o) => { if (!o) setDeleteConfirmOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("placeDetail.deleteConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("placeDetail.deleteConfirmMessage")} {t("placeDetail.deleteConfirmRestore")}
            </p>
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setDeleteConfirmOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={async () => {
                  await placesService.remove(place.public_id);
                  notifyPlacesChanged();
                  nav("/places");
                }}
              >
                {t("placeDetail.delete")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
