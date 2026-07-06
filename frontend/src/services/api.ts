import axios from "axios";
import { ACCESS_KEY, SESSION_INVALIDATED_KEY } from "../utils/constants";
import { clearClientState } from "../utils/client-state";
import { notifyLoading } from "../components/ui/loading-events";

type ApiEnv = {
  MODE?: string;
  VITE_API_URL?: string;
  VITE_APP_ENV?: string;
  VITE_PUBLIC_BASE_URL?: string;
};

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function resolveApiBaseUrl(env: ApiEnv = import.meta.env) {
  if (env.VITE_API_URL) return normalizeBaseUrl(env.VITE_API_URL);

  if (env.VITE_PUBLIC_BASE_URL) {
    return `${normalizeBaseUrl(env.VITE_PUBLIC_BASE_URL)}/api`;
  }

  return "/api";
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
});

function isPublicAuthEndpoint(url?: string) {
  return (
    url?.endsWith("/auth/login/") === true ||
    url?.endsWith("/auth/register/") === true ||
    url?.endsWith("/auth/google/") === true
  );
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_KEY);
  if (token && !isPublicAuthEndpoint(config.url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  notifyLoading(1);
  return config;
});

let refreshing: Promise<string> | null = null;

api.interceptors.response.use(
  (r) => { notifyLoading(-1); return r; },
  async (error) => {
    notifyLoading(-1);
    const original = error.config;

    const isAuthEndpoint =
      original.url?.endsWith("/auth/login/") === true ||
      original.url?.endsWith("/auth/register/") === true ||
      original.url?.endsWith("/auth/refresh/") === true;

    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;

      try {
        refreshing =
          refreshing ??
          api.post("/auth/refresh/").then((r) => {
            localStorage.setItem(ACCESS_KEY, r.data.access);
            refreshing = null;
            return r.data.access as string;
          });

        const access = await refreshing;
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch (e) {
        refreshing = null;
        const isSessionExpired = isSessionInvalidated(e);
        await clearClientState();
        if (isSessionExpired) localStorage.setItem(SESSION_INVALIDATED_KEY, "1");
        window.location.href = "/login";
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  },
);

function isSessionInvalidated(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const code = error.response?.data?.code;
  return code === "session_expired" || code === "session_invalidated" || code === "session_not_found";
}
