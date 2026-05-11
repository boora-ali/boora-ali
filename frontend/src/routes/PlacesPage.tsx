import { startTransition, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { placesService, type Page } from "../services/places.service";
import type { Place, PlaceStatus } from "../types/place";
import { PLACE_STATUSES } from "../utils/constants";
import { PLACES_CHANGED_EVENT } from "../utils/places-state";
import { useDebounce } from "../hooks/useDebounce";
import { PlaceCard } from "../components/places/PlaceCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { PlacesMap } from "../components/places/PlacesMap";
import { isSessionExpiredError } from "../services/api-errors";
import { ResponsiveCardCarousel } from "../components/ui/ResponsiveCardCarousel";

const STATUS_ICONS: Record<string, string> = {
  want_to_visit: "👁",
  visited: "✓",
  favorite: "★",
  would_not_return: "✗",
};

const STATUS_ACTIVE_CLASSES: Record<string, string> = {
  want_to_visit: "bg-blue-500 text-white border-blue-500 shadow-sm",
  visited: "bg-green-500 text-white border-green-500 shadow-sm",
  favorite: "bg-orange-500 text-white border-orange-500 shadow-sm",
  would_not_return: "bg-red-500 text-white border-red-500 shadow-sm",
};

export default function PlacesPage() {
  const { t } = useTranslation();
  const location = useLocation();
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

  useEffect(() => {
    const handlePlacesChanged = () => setRefreshTick((value) => value + 1);
    window.addEventListener(PLACES_CHANGED_EVENT, handlePlacesChanged);
    return () => window.removeEventListener(PLACES_CHANGED_EVENT, handlePlacesChanged);
  }, []);

  useEffect(() => {
    startTransition(() => {
      setLoading(true);
    });
    placesService
      .list({ page, search: debouncedSearch || undefined, status: (status as PlaceStatus) || undefined })
      .then((nextData) => {
        setData(nextData);
        setError("");
      })
      .catch((err) => {
        if (isSessionExpiredError(err)) {
          navigate("/login", { replace: true });
          return;
        }
        setError(t("places.error"));
      })
      .finally(() => setLoading(false));
  }, [navigate, debouncedSearch, status, page, t, location.key, refreshTick]);

  useEffect(() => {
    let cancelled = false;

    placesService
      .listAll({ search: debouncedSearch || undefined, status: (status as PlaceStatus) || undefined })
      .then((places) => {
        if (!cancelled) setMapPlaces(places);
      })
      .catch(() => {
        if (!cancelled) setMapPlaces([]);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, status, location.key, refreshTick]);

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
              : "bg-surface text-text border-border hover:border-muted/50"
          }`}
        >
          {t("places.all")}
        </button>
        {PLACE_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => { setPage(1); setStatus(s.value); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
              status === s.value
                ? STATUS_ACTIVE_CLASSES[s.value]
                : "bg-surface text-text border-border hover:border-muted/50"
            }`}
          >
            {STATUS_ICONS[s.value]} {t(`status.${s.value}`)}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && <LoadingState />}
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

      {!loading && !error && data && data.results.length > 0 && (
        <ResponsiveCardCarousel
          ariaLabel={t("places.title")}
          items={data.results}
          getKey={(place) => place.public_id}
          mobilePageSize={4}
          desktopPageSize={8}
          mobileColumns={2}
          desktopColumns={4}
          renderItem={(place, index) => <PlaceCard place={place} index={index} />}
        />
      )}

      {/* Pagination */}
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
