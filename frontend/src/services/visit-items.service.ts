import { api } from "./api";
import { toFormData, hasFile, stripStringImages } from "./form-data";
import type { VisitItem } from "../types/visit-item";

type VisitItemPayload = Partial<Omit<VisitItem, "photo" | "price">> & { photo?: string | File; price?: number | string | null };

function toPayload(data: VisitItemPayload) {
  const normalized = {
    ...data,
    price: data.price != null ? String(data.price) : undefined,
  };
  const d = stripStringImages(normalized as Record<string, unknown>);
  return hasFile(d) ? toFormData(d) : d;
}

export const visitItemsService = {
  create: (visitPublicId: string, data: VisitItemPayload) =>
    api.post<VisitItem>(`/visits/${visitPublicId}/items/`, toPayload(data)).then((r) => r.data),

  update: (publicId: string, data: VisitItemPayload) =>
    api.patch<VisitItem>(`/visit-items/${publicId}/`, toPayload(data)).then((r) => r.data),

  remove: (publicId: string) => api.delete(`/visit-items/${publicId}/`),
};
