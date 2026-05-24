import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { placesService } from "../services/places.service";
import type { Place, PlaceCoordsStatus } from "../types/place";
import { PlaceForm } from "../components/places/PlaceForm";
import { BackButton } from "../components/ui/BackButton";
import { notifyPlacesChanged } from "../utils/places-state";
import { PageState } from "../components/ui/PageState";

const COORDS_POLL_INTERVAL_MS = 1000;

export default function EditPlacePage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const nav = useNavigate();
  const [place, setPlace] = useState<Place | null>(null);
  const [coordsStatus, setCoordsStatus] = useState<PlaceCoordsStatus | null>(null);
  const [waitingForCoords, setWaitingForCoords] = useState(false);

  useEffect(() => {
    placesService.get(id!).then((loadedPlace) => setPlace(loadedPlace));
  }, [id]);

  useEffect(() => {
    if (!id || !waitingForCoords || place?.coords_status !== "pending") return;

    const interval = window.setInterval(() => {
        placesService.get(id).then((loadedPlace) => {
          setPlace(loadedPlace);
          setCoordsStatus(loadedPlace.coords_status ?? null);

        if (loadedPlace.coords_status === "resolved") {
          setWaitingForCoords(false);
          notifyPlacesChanged();
        }

        if (loadedPlace.coords_status === "failed") {
          setWaitingForCoords(false);
          notifyPlacesChanged();
        }
      });
    }, COORDS_POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [id, nav, place?.coords_status, waitingForCoords]);

  const currentPlace = place;
  if (!currentPlace) {
    return (
      <div className="max-w-xl mx-auto p-4">
        <PageState loading />
      </div>
    );
  }

  const activeCoordsStatus = coordsStatus ?? currentPlace.coords_status ?? null;
  const backFallback = `/places/${currentPlace.public_id}`;

  return (
    <div className="max-w-xl mx-auto p-4">
      <BackButton fallbackTo={backFallback} />
      <h1 className="font-fraunces text-2xl font-bold mb-4 text-text">{t("editPlace.title")}</h1>
      {(waitingForCoords || activeCoordsStatus === "pending" || activeCoordsStatus === "failed") && (
        <div
          className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
            activeCoordsStatus === "failed"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-sky-200 bg-sky-50 text-sky-900"
          }`}
          role="status"
        >
          <div className="font-medium">
            {activeCoordsStatus === "failed"
              ? t("editPlace.coordsFailedTitle")
              : t("editPlace.coordsPendingTitle")}
          </div>
          <p className="mt-1">
            {activeCoordsStatus === "failed"
              ? t("editPlace.coordsFailed")
              : t("editPlace.coordsPending")}
          </p>
        </div>
      )}
      <PlaceForm
        key={`${currentPlace.public_id}:${currentPlace.coords_status ?? ""}:${currentPlace.latitude ?? ""}:${currentPlace.longitude ?? ""}:${currentPlace.maps_url ?? ""}:${currentPlace.updated_at ?? ""}`}
        initial={currentPlace}
        onSubmit={async (d) => {
          const updatedPlace = await placesService.update(currentPlace.public_id, d);
          setPlace(updatedPlace);
          setCoordsStatus(updatedPlace.coords_status ?? null);
          notifyPlacesChanged();

          if (updatedPlace.coords_status === "pending") {
            setWaitingForCoords(true);
            return;
          }

          nav(`/places/${updatedPlace.public_id}`);
        }}
        onResolveMapsUrl={async (d) => {
          const updatedPlace = await placesService.update(currentPlace.public_id, d);
          setPlace(updatedPlace);
          setCoordsStatus(updatedPlace.coords_status ?? null);
          notifyPlacesChanged();

          if (updatedPlace.coords_status === "pending") {
            setWaitingForCoords(true);
            return;
          }
          setWaitingForCoords(false);
        }}
      />
    </div>
  );
}
