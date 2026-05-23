import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Share2, MessageCircle, Link as LinkIcon, Check } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { shareService } from "../services/share.service";
import { placesService, type PlaceWithVisits } from "../services/places.service";
import { visitsService } from "../services/visits.service";
import { collectionsService, type Collection } from "../services/collections.service";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "../components/ui/Badge";
import { LoadingState } from "../components/ui/LoadingState";
import { EmptyState } from "../components/ui/EmptyState";
import { LottieState } from "../components/ui/LottieState";
import { VisitCard } from "../components/visits/VisitCard";
import { BackButton } from "../components/ui/BackButton";
import { MapModal } from "../components/ui/MapModal";
import { AuthImage } from "../components/ui/AuthImage";
import { ResponsiveCardCarousel } from "../components/ui/ResponsiveCardCarousel";
import { fmtPrice, fmtRating } from "../utils/formatters";
import { sanitizeUrl } from "../utils/url";
import { notifyPlacesChanged } from "../utils/places-state";
import NotFoundPage from "./NotFoundPage";

const COORDS_POLL_INTERVAL_MS = 1000;

function ShareButton({ placePublicId, placeName }: { placePublicId: string; placeName: string }) {
  const { t } = useTranslation();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function getOrCreateUrl(): Promise<string> {
    if (shareUrl) return shareUrl;
    const result = await shareService.createShare(placePublicId);
    setShareUrl(result.url);
    return result.url;
  }

  async function handleShare() {
    try {
      const url = await getOrCreateUrl();
      if (navigator.share) {
        await navigator.share({ title: placeName, url });
        return;
      }
      setPopoverOpen(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPopoverOpen(true);
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setPopoverOpen(false);
      }, 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" onClick={handleShare}>
          <Share2 className="w-4 h-4 mr-2" />
          {t("share.button")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2 flex flex-col gap-1">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${placeName}: ${shareUrl ?? ""}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted"
        >
          <MessageCircle className="w-4 h-4 text-green-600" />
          WhatsApp
        </a>
        <button
          type="button"
          onClick={() => shareUrl && handleCopy(shareUrl)}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted text-left"
        >
          {copied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
          {copied ? t("share.copied") : t("share.copy_link")}
        </button>
      </PopoverContent>
    </Popover>
  );
}

export default function PlaceDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const nav = useNavigate();
  const [place, setPlace] = useState<PlaceWithVisits | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [coverLightboxOpen, setCoverLightboxOpen] = useState(false);
  const [collectionSheetOpen, setCollectionSheetOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [placeCollectionIds, setPlaceCollectionIds] = useState<Set<string>>(new Set());
  const collectionsLoaded = useRef(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmoji, setNewEmoji] = useState("📍");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

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

  useEffect(() => {
    if (!place) return;
    if (collectionsLoaded.current) return;
    collectionsLoaded.current = true;
    collectionsService.list().then((data) => {
      setCollections(data);
      const ids = new Set(
        data.filter((c) => c.place_public_ids.includes(place.public_id)).map((c) => c.public_id)
      );
      setPlaceCollectionIds(ids);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.public_id]);

  function openCollectionSheet() {
    setCollectionSheetOpen(true);
  }

  async function handleToggleCollection(collectionId: string) {
    if (!place) return;
    const inCollection = placeCollectionIds.has(collectionId);
    if (inCollection) {
      await collectionsService.removePlace(collectionId, place.public_id);
      setPlaceCollectionIds((prev) => {
        const next = new Set(prev);
        next.delete(collectionId);
        return next;
      });
    } else {
      await collectionsService.addPlace(collectionId, place.public_id);
      setPlaceCollectionIds((prev) => new Set([...prev, collectionId]));
    }
  }

  async function handleCreateCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !place) return;
    setCreating(true);
    try {
      const created = await collectionsService.create({
        name: newName.trim(),
        emoji: newEmoji.trim() || "📍",
        description: "",
      });
      await collectionsService.addPlace(created.public_id, place.public_id);
      setCollections((prev) => (prev ? [...prev, created] : [created]));
      setPlaceCollectionIds((prev) => new Set([...prev, created.public_id]));
      setNewName("");
      setNewEmoji("📍");
      setShowCreateForm(false);
    } finally {
      setCreating(false);
    }
  }

  if (notFound) {
    return <NotFoundPage />;
  }

  if (!place) return <LoadingState variant="detail" />;

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
        <CardContent className="pt-4">
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-background">
              {place.cover_photo ? (
                <button
                  type="button"
                  className="w-full cursor-zoom-in"
                  onClick={() => setCoverLightboxOpen(true)}
                >
                  <AuthImage
                    src={place.cover_photo}
                    alt={place.name}
                    className="h-56 w-full object-cover sm:h-72"
                  />
                </button>
              ) : (
                <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-background to-border/60 text-5xl opacity-40 sm:h-56">
                  🍽
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h1 className="break-words font-fraunces text-3xl font-bold leading-tight text-text">{place.name}</h1>
                <p className="mt-1 text-sm text-muted">{place.category}</p>
                <div className="mt-2">
                  <Badge status={place.status} />
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[280px]">
                <Link to={`/places/${place.public_id}/visits/new`} className="w-full">
                  <Button size="sm" className="w-full">{t("placeDetail.visits.add")}</Button>
                </Link>
                <ShareButton placePublicId={place.public_id} placeName={place.name} />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={openCollectionSheet}
                    aria-label={t("collections.add_to")}
                    className="flex-1"
                  >
                    {placeCollectionIds.size > 0
                      ? t("collections.in_collections", { count: placeCollectionIds.size })
                      : t("collections.add_to")}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="sm" aria-label={t("placeDetail.actions")}>
                        ⋯
                      </Button>
                    </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem asChild>
                        <Link
                          to={`/places/${place.public_id}/edit`}
                          data-testid="place-detail-edit-link"
                        >
                          {t("placeDetail.edit")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setDeleteConfirmOpen(true)}
                      >
                        {t("placeDetail.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
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
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                coordsStatus === "pending"
                  ? "border-sky-200 bg-sky-50 text-sky-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              {coordsStatus === "pending" && (
                <div className="h-14 w-14 shrink-0">
                  <LottieState
                    animation="map-resolving"
                    label={t("placeDetail.coordsPending")}
                    fallback="⌖"
                    className="h-full w-full"
                  />
                </div>
              )}
              <span>
                {coordsStatus === "pending"
                  ? t("placeDetail.coordsPending")
                  : t("placeDetail.coordsFailed")}
              </span>
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
          </div>
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
      </div>

      {place.visits.length === 0 ? (
        <EmptyState
          animation="empty-visits"
          title={t("placeDetail.visits.empty")}
          action={(
            <Link to={`/places/${place.public_id}/visits/new`}>
              <Button>{t("placeDetail.visits.add")}</Button>
            </Link>
          )}
        />
      ) : (
        <ResponsiveCardCarousel
          ariaLabel={t("placeDetail.visits.title", { count: place.visits.length })}
          items={place.visits}
          getKey={(v) => v.public_id}
          mobilePageSize={1}
          desktopPageSize={Math.max(place.visits.length, 1)}
          mobileColumns={1}
          desktopColumns={1}
          renderItem={(v) => (
            <VisitCard
              visit={v}
              onEdit={() => nav(`/visits/${v.public_id}/edit`, { state: { visit: v } })}
              onDelete={async () => {
                await visitsService.remove(v.public_id);
                const refreshed = await placesService.get(id!);
                setPlace(refreshed);
              }}
            />
          )}
        />
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

      <Dialog open={coverLightboxOpen} onOpenChange={setCoverLightboxOpen}>
        <DialogContent className="max-w-screen-md p-0 overflow-hidden" aria-describedby={undefined}>
          {place.cover_photo && (
            <AuthImage src={place.cover_photo} alt={place.name} className="w-full h-auto max-h-[90vh] object-contain" />
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={collectionSheetOpen} onOpenChange={setCollectionSheetOpen}>
        <SheetContent side="right" className="w-80 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("collections.add_to")}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {collections === null ? (
              <p className="text-sm text-muted">{t("common.loading")}</p>
            ) : (
              <>
                {collections.map((c) => {
                  const inCollection = placeCollectionIds.has(c.public_id);
                  return (
                    <button
                      key={c.public_id}
                      type="button"
                      onClick={() => handleToggleCollection(c.public_id)}
                      className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                        inCollection
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-text hover:bg-surface"
                      }`}
                    >
                      <span className="text-xl">{c.emoji}</span>
                      <span className="flex-1 font-medium">{c.name}</span>
                      {inCollection && <span className="text-xs">✓</span>}
                    </button>
                  );
                })}
                <div className="pt-2 border-t border-border">
                  {showCreateForm ? (
                    <form onSubmit={handleCreateCollection} className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newEmoji}
                          onChange={(e) => setNewEmoji(e.target.value)}
                          className="w-12 rounded-lg border border-border bg-background px-2 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          maxLength={4}
                          aria-label="emoji"
                        />
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder={t("collections.name_placeholder")}
                          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          required
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={creating}>
                          {t("common.save")}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setShowCreateForm(false)}>
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowCreateForm(true)}
                    >
                      + {t("collections.new")}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteConfirmOpen} onOpenChange={(o) => { if (!o) setDeleteConfirmOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("placeDetail.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("placeDetail.deleteConfirmMessage")} {t("placeDetail.deleteConfirmRestore")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
