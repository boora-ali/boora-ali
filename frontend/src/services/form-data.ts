const IMAGE_FIELDS = new Set(["photo", "cover_photo", "profile_photo"]);

// Strip image fields that are strings (existing URLs) — only keep File objects.
// Django ImageField rejects strings whether sent as JSON or FormData.
export function stripStringImages(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([k, v]) => !(IMAGE_FIELDS.has(k) && typeof v === "string"))
  );
}

export function toFormData(data: Record<string, unknown>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    if (v instanceof File) { fd.append(k, v); continue; }
    fd.append(k, String(v));
  }
  return fd;
}

export function hasFile(data: Record<string, unknown>): boolean {
  return Object.values(data).some((v) => v instanceof File);
}
