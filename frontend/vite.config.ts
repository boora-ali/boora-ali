import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function parseAllowedHosts(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

function hostFromUrl(value?: string) {
  if (!value) return [];
  try {
    return [new URL(value).hostname];
  } catch {
    return [];
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appEnv = env.VITE_APP_ENV ?? mode;
  const externalDebugHosts =
    appEnv === "preprod" ? [".ngrok-free.app", ".ngrok-free.dev"] : [];

  return {
    plugins: [react()],
    resolve: {
      alias: [
        { find: "@/components/ui/shadcn", replacement: path.resolve(__dirname, "./src/components/ui/shadcn") },
        { find: "@/components/ui", replacement: path.resolve(__dirname, "./@/components/ui") },
        { find: "@/lib/utils", replacement: path.resolve(__dirname, "./src/lib/utils") },
        { find: "@", replacement: path.resolve(__dirname, "./src") },
      ],
    },

    server: {
      allowedHosts: [
        "localhost",
        "127.0.0.1",
        ...externalDebugHosts,
        ...hostFromUrl(env.VITE_PUBLIC_BASE_URL),
        ...parseAllowedHosts(env.VITE_ALLOWED_HOSTS),
      ],
    },

    test: {
      exclude: ["**/e2e/**", "**/node_modules/**", "**/dist/**"],
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
    },
  };
});
