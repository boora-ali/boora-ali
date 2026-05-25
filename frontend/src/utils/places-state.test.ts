import { describe, expect, test } from "vitest";
import { placePageCache } from "../services/places.service";
import { notifyPlacesChanged } from "./places-state";

describe("notifyPlacesChanged", () => {
  test("invalidates the place page cache immediately", () => {
    const page = { count: 1, next: null, previous: null, results: [] };
    placePageCache.set(1, page, "pizza", "visited");

    notifyPlacesChanged();

    expect(placePageCache.get(1, "pizza", "visited")).toBeUndefined();
  });
});
