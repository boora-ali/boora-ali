import { api } from "./api";
import { toFormData, hasFile, stripStringImages } from "./form-data";
import type { Place, PlaceStatus } from "../types/place";
import type { Visit } from "../types/visit";

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
  list: (params: { page?: number; status?: PlaceStatus; search?: string } = {}) =>
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
};
