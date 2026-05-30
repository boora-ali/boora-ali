import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixed, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT_CENTER: [number, number] = [-60.0217314, -3.1190275];
const TILES_ORIGIN = "https://tiles.openfreemap.org";
const MAP_STYLE = "/_tiles/styles/bright";

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
  onUseLocation?: () => void;
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
  onUseLocation,
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
      transformRequest: (url) => ({
        url: url.startsWith(TILES_ORIGIN)
          ? `${window.location.origin}/_tiles${url.slice(TILES_ORIGIN.length)}`
          : url,
      }),
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
    const map = mapRef.current;
    if (!map) return;

    if (!hasCoords) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const attachDrag = (m: maplibregl.Marker) => {
      m.on("dragend", () => {
        const pos = m.getLngLat();
        onChangeRef.current({ latitude: formatCoord(pos.lat), longitude: formatCoord(pos.lng) });
      });
    };

    if (markerRef.current) {
      markerRef.current.setLngLat([lng!, lat!]);
    } else if (map.isStyleLoaded()) {
      markerRef.current = new maplibregl.Marker({ color: "#C1121F", draggable: true })
        .setLngLat([lng!, lat!])
        .addTo(map);
      attachDrag(markerRef.current);
    } else {
      map.once("load", () => {
        if (!markerRef.current && mapRef.current) {
          markerRef.current = new maplibregl.Marker({ color: "#C1121F", draggable: true })
            .setLngLat([lng!, lat!])
            .addTo(mapRef.current);
          attachDrag(markerRef.current);
        }
      });
    }

    map.flyTo({ center: [lng!, lat!], zoom: 15 });
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
    onUseLocation?.();
    setLocating(true);
    setGeolocationError("");

    const applyPosition = (position: GeolocationPosition) => {
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
    };

    navigator.geolocation.getCurrentPosition(
      applyPosition,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeolocationError(geolocationDeniedMessage);
          setLocating(false);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          applyPosition,
          () => {
            setGeolocationError(geolocationErrorMessage);
            setLocating(false);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-text">{label}</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="h-7 gap-1.5 px-2.5 text-xs"
          >
            <LocateFixed className="size-3.5" />
            {locating ? locatingLabel : useCurrentLocationLabel}
          </Button>
          {hasCoords && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 gap-1.5 px-2.5 text-xs text-muted hover:text-destructive"
            >
              <X className="size-3.5" />
              {clearLabel}
            </Button>
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
