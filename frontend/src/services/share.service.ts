import { api } from "./api";

export interface ShareDetail {
  name: string;
  category: string;
  address: string;
  instagram_url: string | null;
  maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  cover_photo_url: string | null;
}

export interface CollectionSharePlace {
  source_public_id: string;
  name: string;
  category: string;
  address: string;
  instagram_url: string;
  maps_url: string;
  coords_status: string;
  latitude: string | null;
  longitude: string | null;
  status: string;
  notes: string;
  cover_photo_url: string | null;
}

export interface CollectionShareDetail {
  name: string;
  emoji: string;
  description: string;
  place_count: number;
  places: CollectionSharePlace[];
}

export interface SavedCollectionResponse {
  public_id: string;
}

export const shareService = {
  createShare: (placePublicId: string) =>
    api.post<{ token: string; url: string }>(`/places/${placePublicId}/share/`).then((r) => r.data),

  getShare: (token: string) =>
    api.get<ShareDetail>(`/share/${token}/`).then((r) => r.data),

  importShare: (token: string) =>
    api.post<{ public_id: string }>(`/share/${token}/import/`).then((r) => r.data),

  createCollectionShare: (collectionPublicId: string) =>
    api.post<{ token: string; url: string }>(`/collections/${collectionPublicId}/share/`).then((r) => r.data),

  revokeCollectionShare: (collectionPublicId: string, token: string) =>
    api.delete(`/collections/${collectionPublicId}/share/${token}/`),

  getCollectionShare: (token: string) =>
    api.get<CollectionShareDetail>(`/share/collections/${token}/`).then((r) => r.data),

  saveCollectionShare: (token: string) =>
    api.post<SavedCollectionResponse>(`/share/collections/${token}/import/`).then((r) => r.data),
};
