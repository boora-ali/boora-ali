import { expect, test } from "vitest";
import { buildGoogleMapsSearchUrl, extractGoogleMapsCoords, getMapsHref, isGoogleMapsUrl, sanitizeUrl } from "./url";

test("detects Google Maps URLs that the backend can resolve later", () => {
  expect(isGoogleMapsUrl("https://maps.app.goo.gl/KaeiRuA7EwybcJCu7")).toBe(true);
  expect(isGoogleMapsUrl("https://goo.gl/maps/xyz")).toBe(true);
  expect(isGoogleMapsUrl("https://www.google.com/maps/@-3.10,-60.02,17z")).toBe(true);
  expect(isGoogleMapsUrl("https://evil.com/maps")).toBe(false);
});

test("extracts coordinates only from full Maps URLs", () => {
  expect(extractGoogleMapsCoords("https://www.google.com/maps/@-3.1019444,-60.0250000,17z")).toEqual({
    latitude: "-3.1019444",
    longitude: "-60.0250000",
  });
  expect(extractGoogleMapsCoords("https://maps.app.goo.gl/KaeiRuA7EwybcJCu7")).toBeNull();
});

test("sanitizes unsafe urls", () => {
  expect(sanitizeUrl("javascript:alert(1)")).toBe("");
});

test("builds a Google Maps fallback URL from coordinates", () => {
  expect(buildGoogleMapsSearchUrl("-3.1019444", "-60.0250000")).toBe(
    "https://www.google.com/maps/search/?api=1&query=-3.1019444%2C-60.025",
  );
  expect(buildGoogleMapsSearchUrl(null, "-60.0250000")).toBe("");
});

test("prefers a safe Maps URL but falls back to coordinates", () => {
  expect(getMapsHref({ mapsUrl: "https://maps.google.com/?q=Cafe", latitude: "-3.1", longitude: "-60" })).toBe(
    "https://maps.google.com/?q=Cafe",
  );
  expect(getMapsHref({ mapsUrl: "", latitude: "-3.1", longitude: "-60" })).toBe(
    "https://www.google.com/maps/search/?api=1&query=-3.1%2C-60",
  );
});
