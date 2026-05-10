import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const DEFAULT_CENTER: [number, number] = [-60.0217314, -3.1190275];
const MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";

type Props = {
  label: string;
  hint: string;
  clearLabel: string;
  useCurrentLocationLabel: string;
  locatingLabel: string;
  geolocationUnavailableMessage: string;
  geolocationDeniedMessage: string;
  geolocationErrorMessage: string;
  zoomInLabel: string;
  zoomOutLabel: string;
  latitude?: string | null;
  longitude?: string | null;
  onChange: (coords: { latitude: string | null; longitude: string | null }) => void;
};

function formatCoord(value: number) {
  return value.toFixed(7);
}

export function LocationPicker({
  label,
  hint,
  clearLabel,
  useCurrentLocationLabel,
  locatingLabel,
  geolocationUnavailableMessage,
  geolocationDeniedMessage,
  geolocationErrorMessage,
  zoomInLabel,
  zoomOutLabel,
  latitude,
  longitude,
  onChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const [locating, setLocating] = useState(false);
  const [geolocationError, setGeolocationError] = useState("");
  const [mapError] = useState(false);

  const lat = latitude ? parseFloat(latitude) : null;
  const lng = longitude ? parseFloat(longitude) : null;
  const hasCoords = lat !== null && lng !== null && isFinite(lat) && isFinite(lng);

  useEffect(() => {
    if (!containerRef.current) return;

    const initCenter: [number, number] =
      hasCoords ? [lng!, lat!] : DEFAULT_CENTER;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: initCenter,
      zoom: 15,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    map.once("load", () => {
      if (hasCoords) {
        markerRef.current = new maplibregl.Marker({
          color: "#C1121F",
          draggable: true,
        })
          .setLngLat([lng!, lat!])
          .addTo(map);

        markerRef.current.on("dragend", () => {
          const pos = markerRef.current!.getLngLat();
          onChangeRef.current({
            latitude: formatCoord(pos.lat),
            longitude: formatCoord(pos.lng),
          });
        });
      }
    });

    map.on("click", (e) => {
      const { lat: clickLat, lng: clickLng } = e.lngLat;

      if (markerRef.current) {
        markerRef.current.setLngLat([clickLng, clickLat]);
      } else {
        markerRef.current = new maplibregl.Marker({
          color: "#C1121F",
          draggable: true,
        })
          .setLngLat([clickLng, clickLat])
          .addTo(map);

        markerRef.current.on("dragend", () => {
          const pos = markerRef.current!.getLngLat();
          onChangeRef.current({
            latitude: formatCoord(pos.lat),
            longitude: formatCoord(pos.lng),
          });
        });
      }

      onChangeRef.current({
        latitude: formatCoord(clickLat),
        longitude: formatCoord(clickLng),
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (hasCoords) {
      markerRef.current.setLngLat([lng!, lat!]);
    }
  }, [lat, lng, hasCoords]);

  function handleClear() {
    markerRef.current?.remove();
    markerRef.current = null;
    onChange({ latitude: null, longitude: null });
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setGeolocationError(geolocationUnavailableMessage);
      return;
    }
    setLocating(true);
    setGeolocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: posLat, longitude: posLng } = position.coords;
        mapRef.current?.flyTo({ center: [posLng, posLat], zoom: 16 });

        if (markerRef.current) {
          markerRef.current.setLngLat([posLng, posLat]);
        } else if (mapRef.current) {
          markerRef.current = new maplibregl.Marker({
            color: "#C1121F",
            draggable: true,
          })
            .setLngLat([posLng, posLat])
            .addTo(mapRef.current);

          markerRef.current.on("dragend", () => {
            const pos = markerRef.current!.getLngLat();
            onChangeRef.current({
              latitude: formatCoord(pos.lat),
              longitude: formatCoord(pos.lng),
            });
          });
        }

        onChangeRef.current({
          latitude: formatCoord(posLat),
          longitude: formatCoord(posLng),
        });
        setLocating(false);
      },
      (error) => {
        setGeolocationError(
          error.code === error.PERMISSION_DENIED
            ? geolocationDeniedMessage
            : geolocationErrorMessage,
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text">{label}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="text-xs text-primary transition hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {locating ? locatingLabel : useCurrentLocationLabel}
          </button>
          {hasCoords && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-muted transition hover:text-red-500"
            >
              {clearLabel}
            </button>
          )}
        </div>
      </div>

      <div className="relative h-64 w-full overflow-hidden rounded-xl border border-border">
        {mapError ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Mapa indisponível neste dispositivo
          </div>
        ) : (
          <div ref={containerRef} className="h-full w-full" />
        )}

        {!mapError && (
          <div
            className="absolute right-2 top-2 z-10 flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label={zoomInLabel}
              onClick={() => mapRef.current?.zoomIn()}
              className="flex h-8 w-8 items-center justify-center text-lg leading-none text-text transition hover:bg-background"
            >
              +
            </button>
            <button
              type="button"
              aria-label={zoomOutLabel}
              onClick={() => mapRef.current?.zoomOut()}
              className="flex h-8 w-8 items-center justify-center border-t border-border text-lg leading-none text-text transition hover:bg-background"
            >
              −
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-muted">{hint}</p>
      {geolocationError && <p className="text-xs text-red-500">{geolocationError}</p>}
      {hasCoords && (
        <p className="text-xs text-muted">
          {formatCoord(lat!)}, {formatCoord(lng!)}
        </p>
      )}
    </div>
  );
}
