const IMAGE_FIELDS = new Set(["photo", "cover_photo", "profile_photo"]);

// Strip image fields that are non-empty strings (existing URLs).
// Empty string "" is preserved as null to signal removal to the backend.
// Django ImageField rejects URL strings whether sent as JSON or FormData.
export function stripStringImages(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (IMAGE_FIELDS.has(k) && typeof v === "string") {
      if (v === "") out[k] = null;
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function toFormData(data: Record<string, unknown>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v === null) {
      if (IMAGE_FIELDS.has(k)) fd.append(k, "");
      continue;
    }
    if (v instanceof File) { fd.append(k, v); continue; }
    fd.append(k, String(v));
  }
  return fd;
}

export function hasFile(data: Record<string, unknown>): boolean {
  return Object.values(data).some((v) => v instanceof File);
}
