import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Place, PlaceStatus } from "../../types/place";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";
const DEFAULT_CENTER: [number, number] = [-60.0217314, -3.1190275];

const STATUS_COLORS: Record<PlaceStatus, string> = {
  want_to_visit: "#2563eb",
  visited: "#16a34a",
  favorite: "#d97706",
  would_not_return: "#dc2626",
};

const STATUS_LABELS: PlaceStatus[] = [
  "want_to_visit",
  "visited",
  "favorite",
  "would_not_return",
];


export function PlacesMap({ places }: { places: Place[] }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const loadedRef = useRef(false);
  const [mapError] = useState(false);

  const mappedPlaces = places.flatMap((place) => {
    const lat = place.latitude ? parseFloat(place.latitude) : NaN;
    const lng = place.longitude ? parseFloat(place.longitude) : NaN;
    if (!isFinite(lat) || !isFinite(lng)) return [];
    return [{ place, lat, lng }];
  });

  function addMarkers(map: maplibregl.Map) {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (mappedPlaces.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();

    mappedPlaces.forEach(({ place, lat, lng }) => {
      const color = STATUS_COLORS[place.status];

      const popupHtml = `
        <div style="min-width:180px;padding:4px 2px">
          <p style="font-weight:600;font-size:15px;margin:0 0 2px;color:#1A1208">${place.name}</p>
          <p style="font-size:12px;color:#6b7280;margin:0 0 8px">${place.category ?? ""}</p>
          ${place.address ? `<p style="font-size:12px;color:#6b7280;margin:0 0 8px">${place.address}</p>` : ""}
          <a href="/places/${place.public_id}"
             style="display:block;text-align:center;padding:6px 12px;background:#C1121F;color:#fff;border-radius:8px;font-size:13px;font-weight:500;text-decoration:none">
            ${t("common.open")}
          </a>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 25, closeButton: true })
        .setHTML(popupHtml);

      const marker = new maplibregl.Marker({ color, anchor: "bottom" })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([lng, lat]);
    });

    if (mappedPlaces.length === 1) {
      map.flyTo({ center: [mappedPlaces[0].lng, mappedPlaces[0].lat], zoom: 15 });
    } else {
      map.fitBounds(bounds, { padding: 72, maxZoom: 16 });
    }
  }

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    map.once("load", () => {
      loadedRef.current = true;
      addMarkers(map);
    });

    mapRef.current = map;

    return () => {
      loadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current && loadedRef.current) {
      addMarkers(mapRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-fraunces text-xl font-semibold text-text">
            {t("places.map.title")}
          </h2>
          <p className="text-sm text-muted">
            {t("places.map.count", { count: mappedPlaces.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_LABELS.map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[status] }}
              />
              {t(`status.${status}`)}
            </span>
          ))}
        </div>
      </div>

      <div className="relative h-80 w-full sm:h-96">
        {mapError ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            {t("places.map.webglUnavailable", "Mapa indisponível neste dispositivo")}
          </div>
        ) : (
          <div ref={containerRef} className="h-full w-full" />
        )}

        {!mapError && mappedPlaces.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4 text-center text-sm text-muted">
            {t("places.map.empty")}
          </div>
        )}

        {!mapError && (
          <div className="absolute right-2 top-2 z-10 flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
            <button
              type="button"
              aria-label={t("places.map.zoomIn")}
              onClick={() => mapRef.current?.zoomIn()}
              className="flex h-8 w-8 items-center justify-center text-lg leading-none text-text transition hover:bg-background"
            >
              +
            </button>
            <button
              type="button"
              aria-label={t("places.map.zoomOut")}
              onClick={() => mapRef.current?.zoomOut()}
              className="flex h-8 w-8 items-center justify-center border-t border-border text-lg leading-none text-text transition hover:bg-background"
            >
              −
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
