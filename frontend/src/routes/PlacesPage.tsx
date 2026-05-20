import { startTransition, useEffect, useRef, useState, type ComponentType } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { placesService, placePageCache, type Page } from "../services/places.service";
import type { Place, PlaceStatus } from "../types/place";
import { PLACE_STATUSES } from "../utils/constants";
import { PLACES_CHANGED_EVENT } from "../utils/places-state";
import { useDebounce } from "../hooks/useDebounce";
import { PlaceCard } from "../components/places/PlaceCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Check, Star, X, BookOpen } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { PlacesMap } from "../components/places/PlacesMap";
import { isSessionExpiredError } from "../services/api-errors";
import { PaginationDots } from "../components/ui/PaginationDots";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

const PAGE_SIZE = 4;

const STATUS_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  want_to_visit: Eye,
  visited: Check,
  favorite: Star,
  would_not_return: X,
};

const STATUS_ACTIVE_CLASSES: Record<string, string> = {
  want_to_visit: "bg-blue-500 text-white border-blue-500 shadow-sm",
  visited: "bg-green-500 text-white border-green-500 shadow-sm",
  favorite: "bg-orange-500 text-white border-orange-500 shadow-sm",
  would_not_return: "bg-red-500 text-white border-red-500 shadow-sm",
};

export default function PlacesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<Page<Place> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [status, setStatus] = useState<PlaceStatus | "">("");
  const [page, setPage] = useState(1);
  const [mapPlaces, setMapPlaces] = useState<Place[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const skipNextSelect = useRef(false);

  useEffect(() => {
    const handlePlacesChanged = () => setRefreshTick((value) => value + 1);
    window.addEventListener(PLACES_CHANGED_EVENT, handlePlacesChanged);
    return () => window.removeEventListener(PLACES_CHANGED_EVENT, handlePlacesChanged);
  }, []);

  // Reset cache and page when filters/search change (React docs pattern: storing prev render info)
  const [prevFilters, setPrevFilters] = useState({ debouncedSearch, status, refreshTick });
  if (
    prevFilters.debouncedSearch !== debouncedSearch ||
    prevFilters.status !== status ||
    prevFilters.refreshTick !== refreshTick
  ) {
    setPrevFilters({ debouncedSearch, status, refreshTick });
    placePageCache.invalidate();
    setPage(1);
  }

  useEffect(() => {
    const cached = placePageCache.get(page, debouncedSearch, status);
    if (cached) {
      startTransition(() => {
        setData(cached);
        setLoading(false);
      });
      return;
    }

    let cancelled = false;
    startTransition(() => {
      setLoading(true);
    });
    placesService
      .list({ page, search: debouncedSearch || undefined, status: (status as PlaceStatus) || undefined })
      .then((nextData) => {
        if (cancelled) return;
        placePageCache.set(page, nextData, debouncedSearch, status);
        setData(nextData);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        if (isSessionExpiredError(err)) {
          navigate("/login", { replace: true });
          return;
        }
        setError(t("places.error"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, debouncedSearch, status, page, t, refreshTick]);

  useEffect(() => {
    if (!showMap) return;
    let cancelled = false;
    placesService
      .listMapPins({ search: debouncedSearch || undefined, status: (status as PlaceStatus) || undefined })
      .then((places) => {
        if (!cancelled) setMapPlaces(places);
      })
      .catch(() => {
        if (!cancelled) setMapPlaces([]);
      });
    return () => {
      cancelled = true;
    };
  }, [showMap, debouncedSearch, status, refreshTick]);

  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;

  // Sync carousel position with `page` state (e.g. when filters reset to 1)
  useEffect(() => {
    if (!carouselApi) return;
    if (carouselApi.selectedScrollSnap() === page - 1) return;
    skipNextSelect.current = true;
    carouselApi.scrollTo(page - 1, true);
  }, [carouselApi, page, totalPages]);

  // Listen to swipe / drag → setPage
  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => {
      if (skipNextSelect.current) {
        skipNextSelect.current = false;
        return;
      }
      setPage(carouselApi.selectedScrollSnap() + 1);
    };
    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-fraunces text-3xl font-bold text-text leading-none">
            {t("places.title")}
          </h1>
          <p className="text-muted text-sm mt-1">{t("places.subtitle")}</p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
          <Link to="/collections" className="flex-1 sm:flex-none">
            <Button size="sm" variant="secondary" className="inline-flex items-center gap-1.5 w-full sm:w-auto">
              <BookOpen className="h-3.5 w-3.5" />
              {t("collections.title")}
            </Button>
          </Link>
          <Link to="/places/new" className="flex-1 sm:flex-none" data-testid="places-new-place-link">
            <Button size="sm" className="w-full sm:w-auto" data-testid="places-new-place-button">
              {t("places.new")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder={t("places.search")}
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.target.value);
        }}
      />

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setPage(1); setStatus(""); }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
            status === ""
              ? "bg-primary text-white border-primary shadow-sm"
              : "bg-surface text-text border-border hover:bg-muted/20 hover:border-muted"
          }`}
        >
          {t("places.all")}
        </button>
        {PLACE_STATUSES.map((s) => {
          const StatusIcon = STATUS_ICONS[s.value];
          return (
            <button
              key={s.value}
              onClick={() => { setPage(1); setStatus(s.value); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                status === s.value
                  ? STATUS_ACTIVE_CLASSES[s.value]
                  : "bg-surface text-text border-border hover:bg-muted/20 hover:border-muted"
              }`}
            >
              {StatusIcon && <StatusIcon className="h-3.5 w-3.5" />}
              {t(`status.${s.value}`)}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading && !data && <LoadingState />}
      {!loading && error && <ErrorMessage message={error} />}
      {!loading && !error && data?.count === 0 && (
        <EmptyState
          title={debouncedSearch ? t("places.emptySearch.title") : t("places.empty.title")}
          description={debouncedSearch ? t("places.emptySearch.description") : t("places.empty.description")}
          action={!debouncedSearch ? (
            <Link to="/places/new">
              <Button>{t("places.new")}</Button>
            </Link>
          ) : undefined}
        />
      )}

      {!error && data && data.results.length > 0 && (
        <Carousel
          aria-label={t("places.title")}
          className="w-full"
          opts={{ align: "start", dragFree: false, startIndex: page - 1 }}
          setApi={setCarouselApi}
        >
          <CarouselContent>
            {Array.from({ length: totalPages }, (_, i) => {
              const slidePage = i + 1;
              const cached = placePageCache.get(slidePage, debouncedSearch, status)?.results;
              const slidePlaces = cached ?? (slidePage === page ? data.results : undefined);
              return (
                <CarouselItem key={i}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {slidePlaces
                      ? slidePlaces.map((place, idx) => (
                          <PlaceCard key={place.public_id} place={place} index={idx} />
                        ))
                      : Array.from({ length: PAGE_SIZE }, (_, j) => (
                          <div
                            key={j}
                            className="h-64 rounded-2xl bg-muted-foreground/10 animate-pulse"
                          />
                        ))}
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      )}

      {!error && data && totalPages > 1 && (
        <PaginationDots
          count={totalPages}
          current={page - 1}
          onChange={(idx) => carouselApi?.scrollTo(idx)}
          ariaLabel={t("places.title")}
        />
      )}

      {!loading && !error && data && data.count > 0 && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowMap((value) => !value)}
          >
            {showMap ? t("places.map.hide") : t("places.map.show")}
          </Button>
        </div>
      )}

      {!loading && !error && data && data.count > 0 && showMap && (
        <PlacesMap places={mapPlaces.length > 0 ? mapPlaces : data.results} />
      )}
    </div>
  );
}
