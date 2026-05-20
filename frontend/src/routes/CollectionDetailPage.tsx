import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collectionsService, type CollectionDetail } from "../services/collections.service";
import type { Place } from "../types/place";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "../components/ui/LoadingState";
import { BackButton } from "../components/ui/BackButton";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { PlaceCard } from "../components/places/PlaceCard";
import { PlacesMap } from "../components/places/PlacesMap";
import { Button } from "@/components/ui/button";
import NotFoundPage from "./NotFoundPage";

export default function CollectionDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<{
    status: "idle" | "loading" | "error";
    data: CollectionDetail | null;
  }>({ status: "idle", data: null });
  const [notFound, setNotFound] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    if (prevId.current === id) return;
    prevId.current = id;

    setState({ status: "loading", data: null });

    collectionsService
      .get(id)
      .then((data) => setState({ status: "idle", data }))
      .catch((err) => {
        if (err?.isNotFound) {
          setNotFound(true);
        } else {
          setState({ status: "error", data: null });
        }
      });
  }, [id]);

  async function handleRemovePlace(place: Place) {
    if (!id) return;
    await collectionsService.removePlace(id, place.public_id);
    setState((prev) => {
      if (!prev.data) return prev;
      const places = prev.data.places.filter((p) => p.public_id !== place.public_id);
      return { ...prev, data: { ...prev.data, places, place_count: places.length } };
    });
  }

  async function handleDeleteCollection() {
    if (!id || !window.confirm(t("collections.delete_confirm"))) return;
    setDeleting(true);
    try {
      await collectionsService.delete(id);
      navigate("/collections", { replace: true });
    } finally {
      setDeleting(false);
    }
  }

  if (notFound) return <NotFoundPage />;
  if (state.status === "loading") return <LoadingState variant="detail" />;
  if (state.status === "error")
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <ErrorMessage message={t("common.loading")} />
      </div>
    );

  const collection = state.data;
  if (!collection) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <BackButton />
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{collection.emoji}</span>
              <div>
                <h1 className="font-fraunces text-3xl font-bold text-text">{collection.name}</h1>
                {collection.description && (
                  <p className="mt-1 text-sm text-muted">{collection.description}</p>
                )}
                <p className="mt-1 text-sm text-muted">
                  {collection.place_count} {t("collections.places_count")}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDeleteCollection}
              disabled={deleting}
              className="shrink-0 text-destructive hover:text-destructive"
            >
              {t("collections.delete")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {collection.places.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">{t("collections.empty_places")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {collection.places.map((place, idx) => (
              <div key={place.public_id} className="relative group">
                <PlaceCard place={place} index={idx} />
                <button
                  type="button"
                  onClick={() => handleRemovePlace(place)}
                  title={t("collections.remove_place")}
                  className="absolute top-2 right-2 z-10 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white text-xs hover:bg-red-600 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowMap((v) => !v)}
            >
              {showMap ? t("places.map.hide") : t("places.map.show")}
            </Button>
          </div>

          {showMap && <PlacesMap places={collection.places} />}
        </>
      )}
    </div>
  );
}
