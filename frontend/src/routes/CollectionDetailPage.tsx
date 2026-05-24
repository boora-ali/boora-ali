import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collectionsService, type CollectionDetail } from "../services/collections.service";
import type { Place } from "../types/place";
import { BackButton } from "../components/ui/BackButton";
import { PlaceCard } from "../components/places/PlaceCard";
import { PlacesMap } from "../components/places/PlacesMap";
import { Button } from "@/components/ui/button";
import NotFoundPage from "./NotFoundPage";
import { X, Trash2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageState } from "../components/ui/PageState";

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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
    toast(t("collections.place_removed"));
  }

  async function handleDeleteCollection() {
    if (!id) return;
    setDeleting(true);
    try {
      await collectionsService.delete(id);
      navigate("/collections", { replace: true });
    } finally {
      setDeleting(false);
    }
  }

  if (notFound) return <NotFoundPage />;
  const collection = state.data;

  if (!collection) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <PageState
          loading={state.status === "loading"}
          error={state.status === "error" ? t("common.error") : ""}
        >
          {null}
        </PageState>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <PageState
        loading={state.status === "loading"}
        error={state.status === "error" ? t("common.error") : ""}
        empty={collection.places.length === 0}
        emptyNode={(
          <div className="flex flex-col items-center gap-3 py-16 text-center animate-fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface border border-border">
              <FolderOpen className="h-7 w-7 text-muted" />
            </div>
            <p className="font-fraunces text-lg font-semibold text-text">{t("collections.empty_places")}</p>
          </div>
        )}
      >
        <>
          <BackButton />
          <div className="flex items-start justify-between gap-3 pb-2 border-b border-border">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface border border-border text-3xl shadow-sm">
                {collection.emoji}
              </span>
              <div>
                <h1 className="font-fraunces text-2xl font-bold text-text leading-tight">{collection.name}</h1>
                <p className="mt-0.5 text-sm text-muted">
                  {collection.description
                    ? `${collection.description} · `
                    : ""}
                  {collection.place_count} {t("collections.places_count")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleting}
              title={t("collections.delete")}
              className="shrink-0 p-2 rounded-lg text-muted hover:text-destructive hover:bg-surface border border-transparent hover:border-border transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {collection.places.map((place, idx) => (
              <div key={place.public_id} className="relative group">
                <PlaceCard place={place} index={idx} />
                <button
                  type="button"
                  onClick={() => handleRemovePlace(place)}
                  title={t("collections.remove_place")}
                  className="absolute top-2 right-2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors sm:hidden sm:group-hover:flex"
                >
                  <X className="h-3.5 w-3.5" />
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
      </PageState>
      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) setShowDeleteDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("collections.delete")}</DialogTitle>
            <DialogDescription>{t("collections.delete_confirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDeleteCollection}>
              {t("collections.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
