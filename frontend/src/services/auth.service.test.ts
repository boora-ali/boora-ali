import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import { authService } from "./auth.service";
import { api } from "./api";
import { ACCESS_KEY } from "../utils/constants";

vi.mock("./api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
  },
}));
vi.mock("../utils/client-state", () => ({
  clearClientState: vi.fn().mockResolvedValue(undefined),
  notifyAuthStateChanged: vi.fn(),
}));

const mockUser = {
  id: 1,
  username: "ana",
  email: "ana@ex.com",
  display_name: "Ana",
  nickname: "",
  profile_photo_url: "",
  is_google_account: false,
  terms_accepted_at: null,
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

test("googleLogin stores only the access token (no refresh in localStorage)", async () => {
  vi.mocked(api.post).mockResolvedValue({
    data: {
      access: "access-token",
    },
  } as never);

  await authService.googleLogin("google-id-token");

  expect(api.post).toHaveBeenCalledWith("/auth/google/", { id_token: "google-id-token" });
  expect(localStorage.getItem(ACCESS_KEY)).toBe("access-token");
  expect(localStorage.getItem("boraali_refresh")).toBeNull();
});

describe("authService.login", () => {
  test("chama POST /auth/login/ com username e password", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { access: "acc", refresh: "ref" },
    } as never);

    await authService.login("ana", "secret");

    expect(api.post).toHaveBeenCalledWith(
      "/auth/login/",
      expect.objectContaining({ username: "ana", password: "secret" })
    );
  });

  test("persiste apenas o access token no localStorage (sem refresh)", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { access: "acc-token" },
    } as never);

    await authService.login("ana", "secret");

    expect(localStorage.getItem(ACCESS_KEY)).toBe("acc-token");
    expect(localStorage.getItem("boraali_refresh")).toBeNull();
  });

  it("login does not store refresh token in localStorage", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { access: "test_access_token" } } as never);
    await authService.login("user", "pass");
    expect(localStorage.getItem("boraali_refresh")).toBeNull();
    expect(localStorage.getItem(ACCESS_KEY)).toBe("test_access_token");
  });
});

describe("authService.me", () => {
  test("chama GET /auth/me/ e retorna o usuário", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockUser } as never);

    const result = await authService.me();

    expect(api.get).toHaveBeenCalledWith("/auth/me/");
    expect(result).toEqual(mockUser);
  });
});

describe("authService.logout", () => {
  test("chama POST /auth/logout/ sem body (refresh via cookie)", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({} as never);

    await authService.logout();

    expect(api.post).toHaveBeenCalledWith("/auth/logout/");
  });

  it("logout does not need to send refresh token in body", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} } as never);
    await authService.logout();
    expect(api.post).toHaveBeenCalledWith("/auth/logout/");
  });

  test("conclui o logout e chama clearClientState mesmo se o servidor rejeitar", async () => {
    const { clearClientState } = await import("../utils/client-state");
    vi.mocked(api.post).mockRejectedValueOnce(new Error("Network error"));

    await authService.logout();

    expect(clearClientState).toHaveBeenCalledTimes(1);
  });
});

describe("authService.register", () => {
  test("chama POST /auth/register/ com os dados do usuário", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} } as never);

    await authService.register({
      username: "ana",
      email: "ana@ex.com",
      password: "Abc12345",
      confirm_password: "Abc12345",
      terms_accepted: true,
    });

    expect(api.post).toHaveBeenCalledWith(
      "/auth/register/",
      expect.objectContaining({ username: "ana", email: "ana@ex.com" })
    );
  });
});
