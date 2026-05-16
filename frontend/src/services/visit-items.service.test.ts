import { beforeEach, describe, expect, test, vi } from "vitest";
import { visitItemsService } from "./visit-items.service";
import { api } from "./api";

vi.mock("./api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("./form-data", () => ({
  toFormData: vi.fn((d: unknown) => d),
  hasFile: vi.fn(() => false),
  stripStringImages: vi.fn((d: unknown) => d),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("visitItemsService.create", () => {
  test("calls POST /visits/:visitId/items/ with payload", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} } as never);
    await visitItemsService.create("visit-1", { name: "Espresso", type: "coffee", rating: 8 });
    expect(api.post).toHaveBeenCalledWith(
      "/visits/visit-1/items/",
      expect.objectContaining({ name: "Espresso" }),
    );
  });

  test("converts numeric price to string in payload", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} } as never);
    await visitItemsService.create("visit-1", { name: "Drip", price: 12.5 });
    expect(api.post).toHaveBeenCalledWith(
      "/visits/visit-1/items/",
      expect.objectContaining({ price: "12.5" }),
    );
  });

  test("omits price when null", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} } as never);
    await visitItemsService.create("visit-1", { name: "Água", price: null });
    const [, payload] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.price).toBeUndefined();
  });
});

describe("visitItemsService.update", () => {
  test("calls PATCH /visit-items/:publicId/ with payload", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} } as never);
    await visitItemsService.update("item-1", { name: "Updated" });
    expect(api.patch).toHaveBeenCalledWith(
      "/visit-items/item-1/",
      expect.objectContaining({ name: "Updated" }),
    );
  });

  test("converts price to string in update payload", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} } as never);
    await visitItemsService.update("item-1", { name: "Café", price: 7 });
    expect(api.patch).toHaveBeenCalledWith(
      "/visit-items/item-1/",
      expect.objectContaining({ price: "7" }),
    );
  });
});

describe("visitItemsService.remove", () => {
  test("calls DELETE /visit-items/:publicId/", async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({} as never);
    await visitItemsService.remove("item-1");
    expect(api.delete).toHaveBeenCalledWith("/visit-items/item-1/");
  });
});
