import { beforeEach, describe, expect, test, vi } from "vitest";
import { placesService, placePageCache } from "./places.service";
import { api } from "./api";

vi.mock("./api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("./form-data", () => ({
  toFormData: vi.fn((d: unknown) => d),
  hasFile: vi.fn(() => false),
  stripStringImages: vi.fn((d: unknown) => d),
}));

vi.mock("../utils/client-state", () => ({
  AUTH_STATE_CHANGED_EVENT: "boraali_auth_state_changed",
  clearClientState: vi.fn(),
  notifyAuthStateChanged: vi.fn(),
}));

const emptyPage = { count: 0, next: null, previous: null, results: [] };

beforeEach(() => {
  vi.clearAllMocks();
  placePageCache.invalidate();
});

describe("placesService.list", () => {
  test("calls GET /places/ with page and status params", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: emptyPage } as never);
    await placesService.list({ page: 2, status: "visited" });
    expect(api.get).toHaveBeenCalledWith("/places/", { params: { page: 2, status: "visited" } });
  });

  test("calls GET /places/ with search param", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: emptyPage } as never);
    await placesService.list({ search: "café" });
    expect(api.get).toHaveBeenCalledWith("/places/", { params: { search: "café" } });
  });
});

describe("placesService.get", () => {
  test("calls GET /places/:public_id/ and returns data", async () => {
    const place = { public_id: "p1", name: "Café X" };
    vi.mocked(api.get).mockResolvedValueOnce({ data: place } as never);
    const result = await placesService.get("p1");
    expect(api.get).toHaveBeenCalledWith("/places/p1/");
    expect(result).toMatchObject({ public_id: "p1" });
  });

  test("throws isNotFound when response is 404", async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 404 } });
    await expect(placesService.get("missing")).rejects.toMatchObject({ isNotFound: true });
  });

  test("re-throws non-404 errors", async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 500 } });
    await expect(placesService.get("p1")).rejects.toMatchObject({ response: { status: 500 } });
  });
});

describe("placesService.create", () => {
  test("calls POST /places/ with payload", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} } as never);
    await placesService.create({ name: "Café X", status: "visited" });
    expect(api.post).toHaveBeenCalledWith(
      "/places/",
      expect.objectContaining({ name: "Café X", status: "visited" }),
    );
  });
});

describe("placesService.update", () => {
  test("calls PATCH /places/:public_id/ with payload", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} } as never);
    await placesService.update("p1", { name: "Novo nome" });
    expect(api.patch).toHaveBeenCalledWith(
      "/places/p1/",
      expect.objectContaining({ name: "Novo nome" }),
    );
  });
});

describe("placesService.remove", () => {
  test("calls DELETE /places/:public_id/", async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({} as never);
    await placesService.remove("p1");
    expect(api.delete).toHaveBeenCalledWith("/places/p1/");
  });
});

describe("placesService.listMapPins", () => {
  test("calls GET /places/map-pins/ with status param", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] } as never);
    await placesService.listMapPins({ status: "favorite" });
    expect(api.get).toHaveBeenCalledWith("/places/map-pins/", {
      params: { status: "favorite" },
    });
  });
});

describe("placePageCache", () => {
  test("returns undefined on cache miss", () => {
    expect(placePageCache.get(1, "pizza", "visited")).toBeUndefined();
  });

  test("stores and retrieves a page correctly", () => {
    const page = { count: 2, next: null, previous: null, results: [] };
    placePageCache.set(1, page, "pizza", "visited");
    expect(placePageCache.get(1, "pizza", "visited")).toEqual(page);
  });

  test("returns undefined after invalidate", () => {
    const page = { count: 1, next: null, previous: null, results: [] };
    placePageCache.set(1, page);
    placePageCache.invalidate();
    expect(placePageCache.get(1)).toBeUndefined();
  });

  test("differentiates cache keys by page, search, and status", () => {
    const page1 = { count: 1, next: null, previous: null, results: [] };
    const page2 = { count: 2, next: null, previous: null, results: [] };
    placePageCache.set(1, page1, "", "");
    placePageCache.set(1, page2, "café", "");
    expect(placePageCache.get(1, "", "")).toEqual(page1);
    expect(placePageCache.get(1, "café", "")).toEqual(page2);
  });
});
