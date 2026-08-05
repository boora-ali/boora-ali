import { beforeEach, expect, test, vi } from "vitest";
import { api } from "./api";
import { categoriesService } from "./categories.service";

vi.mock("./api", () => ({
  api: { get: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test("loads registered categories in one request", async () => {
  vi.mocked(api.get).mockResolvedValueOnce({
    data: { next: null, results: [] },
  } as never);

  await categoriesService.listAll();

  expect(api.get).toHaveBeenCalledOnce();
  expect(api.get).toHaveBeenCalledWith("/categories/", {
    params: { page: 1, page_size: 1000 },
  });
});
