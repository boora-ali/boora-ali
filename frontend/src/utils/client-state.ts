export const AUTH_STATE_CHANGED_EVENT = "auth:changed";

export function notifyAuthStateChanged(): void {
  window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT));
}

export async function clearClientState(): Promise<void> {
  localStorage.clear();
  sessionStorage.clear();
  notifyAuthStateChanged();

  if (typeof caches === "undefined") return;

  const cacheKeys = await caches.keys();
  await Promise.all(cacheKeys.map((key) => caches.delete(key)));
}
