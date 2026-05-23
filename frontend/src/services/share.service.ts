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

export const shareService = {
  createShare: (placePublicId: string) =>
    api.post<{ token: string; url: string }>(`/places/${placePublicId}/share/`).then((r) => r.data),

  getShare: (token: string) =>
    api.get<ShareDetail>(`/share/${token}/`).then((r) => r.data),

  importShare: (token: string) =>
    api.post<{ public_id: string }>(`/share/${token}/import/`).then((r) => r.data),
};
