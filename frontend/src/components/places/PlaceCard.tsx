import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ExternalLink, Share2, Trash2 } from "lucide-react";
import type { Place } from "../../types/place";
import { getMapsHref, sanitizeUrl } from "../../utils/url";
import { UtensilsCrossed } from "lucide-react";
import { ImageWithSpinner } from "../ui/ImageWithSpinner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../ui/context-menu";
import { placesService } from "../../services/places.service";
import { shareService } from "../../services/share.service";
import { toast } from "sonner";

interface PlaceCardProps {
  place: Place;
  index?: number;
  onDeleted?: () => void;
}

const STATUS_SHADOW_CLASSES: Record<Place["status"], string> = {
  want_to_visit: "shadow-[6px_6px_0_#2563eb] hover:shadow-[4px_4px_0_#2563eb] dark:shadow-[6px_6px_0_#5b7cce] dark:hover:shadow-[4px_4px_0_#5b7cce]",
  visited: "shadow-[6px_6px_0_#f59e0b] hover:shadow-[4px_4px_0_#f59e0b] dark:shadow-[6px_6px_0_#d5a43e] dark:hover:shadow-[4px_4px_0_#d5a43e]",
  favorite: "shadow-[6px_6px_0_#e03a3e] hover:shadow-[4px_4px_0_#e03a3e] dark:shadow-[6px_6px_0_#e35b5e] dark:hover:shadow-[4px_4px_0_#e35b5e]",
  would_not_return: "shadow-[6px_6px_0_#000000] hover:shadow-[4px_4px_0_#000000] dark:shadow-[6px_6px_0_#b8ad9d] dark:hover:shadow-[4px_4px_0_#b8ad9d]",
};

export function PlaceCard({ place, index = 0, onDeleted }: PlaceCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sharing, setSharing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const mapsHref = getMapsHref({
    mapsUrl: place.maps_url,
    latitude: place.latitude,
    longitude: place.longitude,
  });

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const { url } = await shareService.createShare(place.public_id);
      if (navigator.share) {
        await navigator.share({ title: place.name, url }).catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          navigator.clipboard.writeText(url).catch(() => {});
          toast.success(t("share.copied"));
        });
      } else {
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.success(t("share.copied"));
      }
    } finally {
      setSharing(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await placesService.remove(place.public_id);
      setDeleteConfirmOpen(false);
      onDeleted?.();
    } catch {
      setDeleteError(t("common.error"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article
          onClick={() => navigate(`/places/${place.public_id}`)}
          className={`group cursor-pointer select-none overflow-hidden border-[3px] border-black bg-surface text-text transition-[transform,box-shadow] duration-150 hover:translate-x-[2px] hover:translate-y-[2px] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-current touch-manipulation dark:border-[color:var(--color-border)] [-webkit-touch-callout:none] ${STATUS_SHADOW_CLASSES[place.status]}`}
          style={{ animationDelay: `${index * 55}ms` }}
        >
          <div className="relative overflow-hidden">
            <ImageWithSpinner
              src={place.cover_photo || undefined}
              alt={place.name}
              wrapperClassName="w-full h-44"
              className="h-44 w-full object-cover group-hover:scale-105 transition-transform duration-500"
              spinnerClassName="rounded-none"
              fallback={
                <div className="flex h-44 w-full items-center justify-center bg-background">
                  <UtensilsCrossed className="h-10 w-10 text-muted opacity-25" />
                </div>
              }
            />
          </div>

          <div className="space-y-3 p-4">
            <div>
              <h3 className="font-fraunces font-semibold text-[1.05rem] leading-snug truncate text-text">
                {place.name}
              </h3>
              <p className="text-muted text-sm mt-0.5 truncate">{place.categories?.map((category) => category.name).join(", ") || place.category}</p>
              {place.address && (
                <p className="text-muted text-xs mt-1 truncate">{place.address}</p>
              )}
              {place.notes && (
                <p className="mt-2 line-clamp-2 text-sm text-text/90">{place.notes}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {sanitizeUrl(place.instagram_url) && (
                <a
                  href={sanitizeUrl(place.instagram_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 border-[3px] border-border bg-background px-2.5 py-1.5 text-xs font-bold text-text shadow-[3px_3px_0_var(--color-shadow)] transition-[transform,box-shadow] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_var(--color-shadow)]"
                  aria-label={t("placeDetail.instagram")}
                  onClick={(event) => event.stopPropagation()}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2">
                    <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="4.5" />
                    <circle cx="12" cy="12" r="3.5" />
                    <circle cx="17.5" cy="6.5" r="0.75" />
                  </svg>
                  {t("placeDetail.instagram")}
                </a>
              )}

              {mapsHref && (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 border-[3px] border-border bg-background px-2.5 py-1.5 text-xs font-bold text-text shadow-[3px_3px_0_var(--color-shadow)] transition-[transform,box-shadow] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_var(--color-shadow)]"
                  aria-label={t("placeDetail.maps")}
                  onClick={(event) => event.stopPropagation()}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  {t("placeDetail.maps")}
                </a>
              )}
            </div>
          </div>
        </article>
      </ContextMenuTrigger>

        <ContextMenuContent>
        <ContextMenuItem onClick={() => navigate(`/places/${place.public_id}`)}>
          <ExternalLink className="mr-2 h-4 w-4" />
          {t("common.open")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleShare}>
          <Share2 className="mr-2 h-4 w-4" />
          {t("share.button")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => setDeleteConfirmOpen(true)}
          className="text-danger focus:text-danger"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("common.delete")}
        </ContextMenuItem>
      </ContextMenuContent>

      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => {
        if (!deleting) setDeleteConfirmOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("placeDetail.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("placeDetail.deleteConfirmMessage")}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              onClick={() => void handleDelete()}
              disabled={deleting}
              aria-busy={deleting}
            >
              {t("common.delete")}
            </Button>
          </div>
          {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
        </DialogContent>
      </Dialog>
    </ContextMenu>
  );
}
