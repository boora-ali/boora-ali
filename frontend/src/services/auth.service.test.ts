import { afterEach, expect, test, vi } from "vitest";
import { authService } from "./auth.service";
import { api } from "./api";
import { ACCESS_KEY, REFRESH_KEY } from "../utils/constants";

vi.mock("./api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

test("googleLogin stores the returned tokens", async () => {
  vi.mocked(api.post).mockResolvedValue({
    data: {
      access: "access-token",
      refresh: "refresh-token",
    },
  } as never);

  await authService.googleLogin("google-id-token");

  expect(api.post).toHaveBeenCalledWith("/auth/google/", { id_token: "google-id-token" });
  expect(localStorage.getItem(ACCESS_KEY)).toBe("access-token");
  expect(localStorage.getItem(REFRESH_KEY)).toBe("refresh-token");
});
