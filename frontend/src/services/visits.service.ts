import { api } from "./api";
import { toFormData, hasFile, stripStringImages } from "./form-data";
import type { Visit } from "../types/visit";

type VisitPayload = Partial<Omit<Visit, "photo">> & { photo?: string | File };

function toPayload(data: VisitPayload) {
  const d = stripStringImages(data as Record<string, unknown>);
  return hasFile(d) ? toFormData(d) : d;
}

export const visitsService = {
  create: (placePublicId: string, data: VisitPayload) =>
    api.post<Visit>(`/places/${placePublicId}/visits/`, toPayload(data)).then((r) => r.data),

  get: (publicId: string) =>
    api.get<Visit>(`/visits/${publicId}/`).then((r) => r.data),

  update: (publicId: string, data: VisitPayload) =>
    api.patch<Visit>(`/visits/${publicId}/`, toPayload(data)).then((r) => r.data),

  remove: (publicId: string) => api.delete(`/visits/${publicId}/`),
};
