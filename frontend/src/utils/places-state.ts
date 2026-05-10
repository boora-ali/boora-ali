export const PLACES_CHANGED_EVENT = "places:changed";

export function notifyPlacesChanged(): void {
  window.dispatchEvent(new Event(PLACES_CHANGED_EVENT));
}
