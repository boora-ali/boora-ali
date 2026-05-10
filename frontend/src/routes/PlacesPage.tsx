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
          <Link to="/places/trash" className="flex-1 sm:flex-none">
            <Button size="sm" variant="secondary" className="w-full sm:w-auto gap-1.5">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              {t("trash.title")}
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
          title={t("places.empty.title")}
          description={t("places.empty.description")}
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {!loading && !error && data?.results.map((p, i) => (
          <PlaceCard key={p.public_id} place={p} index={i} />
        ))}
      </div>

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
        <PlacesMap places={mapPlaces.length > 0 ? mapPlaces : data.results} />
      )}
    </div>
  );
}
