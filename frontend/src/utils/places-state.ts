import { placePageCache } from "../services/places.service";

export const PLACES_CHANGED_EVENT = "places:changed";

export function notifyPlacesChanged(): void {
  // Invalidate the local page cache immediately so the next visit refetches
  // even if no PlacesPage listener is mounted right now.
  placePageCache.invalidate();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PLACES_CHANGED_EVENT));
  }
}
