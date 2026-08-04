import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { collectionsService, type CollectionDetail } from "../services/collections.service";
import { shareService } from "../services/share.service";
import type { Place } from "../types/place";
import { BackButton } from "../components/ui/BackButton";
import { PlaceCard } from "../components/places/PlaceCard";
import { PlacesMap } from "../components/places/PlacesMap";
import { Button } from "@/components/ui/button";
import NotFoundPage from "./NotFoundPage";
import { Check, FolderOpen, Link as LinkIcon, Share2, Trash2, X } from "lucide-react";
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
  const [removeTarget, setRemoveTarget] = useState<Place | null>(null);
  const [removingPlace, setRemovingPlace] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareTokenData, setShareTokenData] = useState<{ token: string; url: string } | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
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

  async function handleRemovePlace() {
    if (!id || !removeTarget || removingPlace) return;
    setRemovingPlace(true);
    setRemoveError("");
    try {
      await collectionsService.removePlace(id, removeTarget.public_id);
      setState((prev) => {
        if (!prev.data) return prev;
        const places = prev.data.places.filter((p) => p.public_id !== removeTarget.public_id);
        return { ...prev, data: { ...prev.data, places, place_count: places.length } };
      });
      setRemoveTarget(null);
      toast(t("collections.place_removed"));
    } catch {
      setRemoveError(t("common.error"));
    } finally {
      setRemovingPlace(false);
    }
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

  async function handleCreateShare() {
    if (!id) return;
    setShareLoading(true);
    try {
      const result = await shareService.createCollectionShare(id);
      setShareTokenData(result);
      setShareDialogOpen(true);
    } catch {
      toast.error(t("collections.share_error"));
    } finally {
      setShareLoading(false);
    }
  }

  async function handleCopyShareLink() {
    if (!shareTokenData) return;
    try {
      await navigator.clipboard.writeText(shareTokenData.url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch {
      toast.error(t("collections.copy_error"));
    }
  }

  async function handleRevokeShare() {
    if (!id || !shareTokenData) return;
    setShareLoading(true);
    try {
      await shareService.revokeCollectionShare(id, shareTokenData.token);
      toast.success(t("collections.share_revoked"));
      setShareDialogOpen(false);
      setShareTokenData(null);
    } catch {
      toast.error(t("collections.share_revoke_error"));
    } finally {
      setShareLoading(false);
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
          <div className="flex flex-col gap-3 border-b border-border pb-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface border border-border text-3xl shadow-sm">
                {collection.emoji}
              </span>
              <div className="min-w-0">
                <h1 className="font-fraunces text-2xl font-bold text-text leading-tight">{collection.name}</h1>
                <p className="mt-0.5 text-sm text-muted">
                  {collection.description
                    ? `${collection.description} · `
                    : ""}
                  {collection.place_count} {t("collections.places_count")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
              <Button type="button" variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={handleCreateShare} disabled={shareLoading}>
                <Share2 className="mr-2 h-4 w-4" />
                {t("collections.share")}
              </Button>
              <button
                type="button"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleting}
                title={t("collections.delete")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted transition-colors hover:border-border hover:bg-surface hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {collection.places.map((place, idx) => (
              <div key={place.public_id} className="relative group">
                <PlaceCard place={place} index={idx} />
                <button
                  type="button"
                  onClick={() => setRemoveTarget(place)}
                  title={t("collections.remove_place")}
                  className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-red-600 sm:hidden sm:group-hover:flex"
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
      <Dialog open={shareDialogOpen} onOpenChange={(open) => { if (!open) setShareDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("collections.share")}</DialogTitle>
            <DialogDescription>{t("collections.share_description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-surface/60 p-3 text-sm break-all">
              {shareTokenData?.url ?? ""}
            </div>
            {shareTokenData && (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleCopyShareLink} disabled={shareLoading}>
                  {shareCopied ? <Check className="mr-2 h-4 w-4" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                  {shareCopied ? t("collections.copied") : t("collections.copy_link")}
                </Button>
                <Button variant="destructive" onClick={handleRevokeShare} disabled={shareLoading}>
                  {t("collections.revoke_share")}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
      <Dialog open={removeTarget !== null} onOpenChange={(open) => {
        if (!open && !removingPlace) setRemoveTarget(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("collections.remove_place")}</DialogTitle>
            <DialogDescription>{t("collections.remove_place_confirm", { name: removeTarget?.name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setRemoveTarget(null)} disabled={removingPlace}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={() => void handleRemovePlace()} disabled={removingPlace} aria-busy={removingPlace}>{t("common.remove")}</Button>
          </DialogFooter>
          {removeError && <p role="alert" className="text-sm text-destructive">{removeError}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
