import { api } from "./api";
import type { Place } from "../types/place";

export interface Collection {
  public_id: string;
  name: string;
  emoji: string;
  description: string;
  place_count: number;
  updated_at: string;
}

export interface CollectionDetail extends Collection {
  places: Place[];
}

export const collectionsService = {
  list: () =>
    api.get<{ count: number; results: Collection[] }>("/collections/").then((r) => r.data.results),
  create: (data: Pick<Collection, "name" | "emoji" | "description">) =>
    api.post<Collection>("/collections/", data).then((r) => r.data),
  get: (id: string) => api.get<CollectionDetail>(`/collections/${id}/`).then((r) => r.data),
  update: (
    id: string,
    data: Partial<Pick<Collection, "name" | "emoji" | "description">>,
  ) => api.patch<Collection>(`/collections/${id}/`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/collections/${id}/`),
  addPlace: (collectionId: string, placeId: string) =>
    api.post(`/collections/${collectionId}/places/${placeId}/`),
  removePlace: (collectionId: string, placeId: string) =>
    api.delete(`/collections/${collectionId}/places/${placeId}/`),
};
