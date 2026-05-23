import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ExternalLink, Share2, Trash2 } from "lucide-react";
import type { Place } from "../../types/place";
import { Badge } from "../ui/Badge";
import { sanitizeUrl } from "../../utils/url";
import { AuthImage } from "../ui/AuthImage";
import { UtensilsCrossed } from "lucide-react";
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

export function PlaceCard({ place, index = 0, onDeleted }: PlaceCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sharing, setSharing] = useState(false);

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
    if (!window.confirm(t("placeDetail.deleteConfirmMessage"))) return;
    await placesService.remove(place.public_id);
    onDeleted?.();
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article
          onClick={() => navigate(`/places/${place.public_id}`)}
          className="bg-surface rounded-2xl border border-border shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden group animate-fade-slide-up cursor-pointer"
          style={{ animationDelay: `${index * 55}ms` }}
        >
          <div className="relative overflow-hidden">
            {place.cover_photo ? (
              <>
                <AuthImage
                  src={place.cover_photo}
                  alt={place.name}
                  className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute bottom-2.5 left-3">
                  <Badge status={place.status} />
                </div>
              </>
            ) : (
              <div className="w-full h-44 bg-gradient-to-br from-background to-border/60 flex items-center justify-center">
                <UtensilsCrossed className="h-10 w-10 text-muted opacity-25" />
                <div className="absolute bottom-2.5 left-3">
                  <Badge status={place.status} />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 p-4">
            <div>
              <h3 className="font-fraunces font-semibold text-[1.05rem] leading-snug truncate text-text">
                {place.name}
              </h3>
              <p className="text-muted text-sm mt-0.5 truncate">{place.category}</p>
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-text transition hover:bg-surface"
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

              {sanitizeUrl(place.maps_url) && (
                <a
                  href={sanitizeUrl(place.maps_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-text transition hover:bg-surface"
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
          onClick={handleDelete}
          className="text-danger focus:text-danger"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("common.delete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
