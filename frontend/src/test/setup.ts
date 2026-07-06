import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";

// maplibre-gl requires WebGL which jsdom does not support — provide a no-op mock
vi.mock("maplibre-gl", () => {
  class MockMap {
    on() { return this; }
    once(event: string, cb: () => void) { if (event === "load") cb(); return this; }
    off() { return this; }
    remove() {}
    addControl() {}
    zoomIn() {}
    zoomOut() {}
    flyTo() {}
    fitBounds() {}
    getCanvas() { return { style: {} }; }
  }
  class MockMarker {
    setLngLat() { return this; }
    setPopup() { return this; }
    addTo() { return this; }
    remove() {}
    getLngLat() { return { lat: 0, lng: 0 }; }
    on() { return this; }
  }
  class MockPopup {
    setHTML() { return this; }
  }
  class MockAttributionControl {}
  class MockLngLatBounds {
    extend() { return this; }
  }
  const maplibre = {
    Map: MockMap,
    Marker: MockMarker,
    Popup: MockPopup,
    AttributionControl: MockAttributionControl,
    LngLatBounds: MockLngLatBounds,
  };
  return { default: maplibre, ...maplibre };
});
import i18n, { LANGUAGE_STORAGE_KEY } from "../i18n";

// jsdom does not implement matchMedia; provide a minimal stub
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: IntersectionObserverMock,
});

Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  value: IntersectionObserverMock,
});

if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false;
}
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
}
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

beforeEach(async () => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
  await i18n.changeLanguage("en");
});
