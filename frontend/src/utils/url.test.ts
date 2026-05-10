import { expect, test } from "vitest";
import { extractGoogleMapsCoords, isGoogleMapsUrl, sanitizeUrl } from "./url";

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
