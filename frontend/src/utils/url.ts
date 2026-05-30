export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(",");
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export type ImageValidationError = "type" | "size" | null;

/**
 * Valida tipo e tamanho de um arquivo antes do envio (validação de UX).
 * A validação real de segurança ocorre no backend.
 */
export function validateImageFile(file: File): ImageValidationError {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
    return "type";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "size";
  }
  return null;
}

const SAFE_SCHEMES = new Set(["http:", "https:"]);
const GOOGLE_MAPS_COORD_PATTERNS = [
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,       // exact place pin — higher precision than viewport
  /@(-?\d+\.\d+),(-?\d+\.\d+)/,             // viewport center — fallback
  /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
  /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
  /\/maps\/search\/(-?\d+\.\d+)[,+\s]+(-?\d+\.\d+)/,
] as const;

function getParsedUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isGoogleMapsUrl(url: string): boolean {
  const parsed = getParsedUrl(url);
  if (!parsed || !SAFE_SCHEMES.has(parsed.protocol)) return false;

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname || "";

  if (host === "goo.gl" || host === "maps.app.goo.gl") return true;
  if (host.startsWith("maps.google.") || host === "maps.google.com") return true;
  if (host.endsWith(".google.com") && path.startsWith("/maps")) return true;
  if (host === "google.com" && path.startsWith("/maps")) return true;
  return false;
}

/**
 * Retorna a URL original se o scheme for http/https.
 * Retorna string vazia para javascript:, data:, file: e qualquer outro scheme perigoso.
 * Usada como camada de defesa no frontend antes de renderizar href vindo da API.
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return "";
  const parsed = getParsedUrl(url);
  return parsed && SAFE_SCHEMES.has(parsed.protocol) ? url : "";
}

export function buildGoogleMapsSearchUrl(latitude: string | number | null | undefined, longitude: string | number | null | undefined): string {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return "";
  const lat = typeof latitude === "number" ? latitude : parseFloat(latitude);
  const lng = typeof longitude === "number" ? longitude : parseFloat(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function getMapsHref(options: {
  mapsUrl?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
}): string {
  return sanitizeUrl(options.mapsUrl) || buildGoogleMapsSearchUrl(options.latitude, options.longitude);
}

export function extractGoogleMapsCoords(url: string): { latitude: string; longitude: string } | null {
  for (const pattern of GOOGLE_MAPS_COORD_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return { latitude: match[1], longitude: match[2] };
    }
  }
  return null;
}
