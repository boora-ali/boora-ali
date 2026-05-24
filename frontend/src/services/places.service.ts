import { api } from "./api";
import { toFormData, hasFile, stripStringImages } from "./form-data";
import type { Place, PlaceStatus } from "../types/place";
import type { Visit } from "../types/visit";
import { AUTH_STATE_CHANGED_EVENT } from "../utils/client-state";

export interface PlaceFilters {
  category?: string;
  status?: PlaceStatus;
  min_rating?: number;
  max_rating?: number;
  date_from?: string;
  date_to?: string;
}

type CacheKey = string;

// 20 min — metade da expiração das presigned URLs do R2 (1h)
// Garante que URLs em cache nunca estejam próximas de expirar ao ser usadas.
const CACHE_TTL_MS = 20 * 60 * 1000;

class PlacePageCache {
  private store: Map<CacheKey, { data: Page<Place>; ts: number }> = new Map();

  private key(page: number, search?: string, status?: string, filters?: PlaceFilters): CacheKey {
    return `${page}|${search ?? ""}|${status ?? ""}|${JSON.stringify(filters ?? {})}`;
  }

  get(page: number, search?: string, status?: string, filters?: PlaceFilters): Page<Place> | undefined {
    const k = this.key(page, search, status, filters);
    const entry = this.store.get(k);
    if (!entry) return undefined;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      this.store.delete(k);
      return undefined;
    }
    return entry.data;
  }

  set(page: number, data: Page<Place>, search?: string, status?: string, filters?: PlaceFilters): void {
    this.store.set(this.key(page, search, status, filters), { data, ts: Date.now() });
  }

  invalidate(): void {
    this.store.clear();
  }
}

export const placePageCache = new PlacePageCache();

if (typeof window !== "undefined") {
  window.addEventListener(AUTH_STATE_CHANGED_EVENT, () =>
    placePageCache.invalidate(),
  );
}

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type PlaceWithVisits = Place & { visits: Visit[] } & {
  consumables_count: number;
  average_consumable_rating: number | null;
  total_consumed_amount: string | null;
};

type PlacePayload = Partial<Omit<Place, "cover_photo">> & { cover_photo?: string | File };

function toPayload(data: PlacePayload) {
  const d = stripStringImages(data as Record<string, unknown>);
  return hasFile(d) ? toFormData(d) : d;
}

export const placesService = {
  list: (params: { page?: number; status?: PlaceStatus; search?: string } & PlaceFilters = {}) =>
    api.get<Page<Place>>("/places/", { params }).then((r) => r.data),

  listAll: async (params: { status?: PlaceStatus; search?: string } = {}) => {
    const places: Place[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const data = await placesService.list({ ...params, page });
      places.push(...data.results);
      hasNext = Boolean(data.next);
      page += 1;
    }

    return places;
  },

  listMapPins: (params: { status?: PlaceStatus; search?: string } = {}) =>
    api
      .get<Page<Place>>("/places/", {
        params: { ...params, has_coords: true, page_size: 500, ordering: "name" },
      })
      .then((r) => r.data.results),

  get: async (publicId: string) => {
    try {
      return await api.get<PlaceWithVisits>(`/places/${publicId}/`).then((r) => r.data);
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        throw { isNotFound: true };
      }
      throw error;
    }
  },

  create: (data: PlacePayload) =>
    api.post<Place>("/places/", toPayload(data)).then((r) => r.data),

  update: (publicId: string, data: PlacePayload) =>
    api.patch<Place>(`/places/${publicId}/`, toPayload(data)).then((r) => r.data),

  remove: (publicId: string) => api.delete(`/places/${publicId}/`),

  trash: (params: { page?: number } = {}) =>
    api.get<Page<Place>>("/places/trash/", { params }).then((r) => r.data),

  restore: (publicId: string) =>
    api.post(`/places/${publicId}/restore/`).then((r) => r.data),

  permanentDelete: (publicId: string) => api.delete(`/places/${publicId}/permanent/`),
};
