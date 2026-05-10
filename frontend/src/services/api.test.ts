import type { InternalAxiosRequestConfig } from "axios";
import { api, resolveApiBaseUrl } from "./api";
import { ACCESS_KEY } from "../utils/constants";

type RequestHandler = {
  fulfilled: (
    value: InternalAxiosRequestConfig,
  ) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>;
};

test("adds Authorization header when token exists in localStorage", async () => {
  localStorage.setItem(ACCESS_KEY, "test-token-abc");

  const { handlers } = api.interceptors.request as unknown as { handlers: RequestHandler[] };
  const lastHandler = handlers[handlers.length - 1];
  const cfg = await lastHandler.fulfilled({ headers: {} } as InternalAxiosRequestConfig);

  expect(cfg.headers.Authorization).toBe("Bearer test-token-abc");
  localStorage.removeItem(ACCESS_KEY);
});

test("resolves local API url for dev mode", () => {
  expect(resolveApiBaseUrl({ VITE_APP_ENV: "dev" })).toBe("http://localhost:8000/api");
});

test("resolves public API url for preprod mode", () => {
  expect(resolveApiBaseUrl({
    VITE_APP_ENV: "preprod",
    VITE_PUBLIC_BASE_URL: "https://example.ngrok-free.dev/",
  })).toBe("https://example.ngrok-free.dev/api");
});

test("explicit API url overrides environment defaults", () => {
  expect(resolveApiBaseUrl({
    VITE_APP_ENV: "prod",
    VITE_API_URL: "https://api.example.com/api",
  })).toBe("https://api.example.com/api");
});
