import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { aeoVitePlugin } from "aeo.js/vite";
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
    plugins: [
      react(),
      aeoVitePlugin({
        title: "Bora Ali",
        description:
          "Diário pessoal de lugares — registre lugares, visitas e pratos que valem lembrar",
        url: "https://booraali.com.br",
        pages: [
          {
            pathname: "/",
            title: "Bora Ali — Entre na sua conta",
            description: "Acesse seu diário de lugares e experiências. Salve e reviva memórias dos lugares que você visitou.",
          },
          {
            pathname: "/register",
            title: "Bora Ali — Crie sua conta",
            description: "Comece a registrar seus lugares favoritos gratuitamente. Crie sua conta no Bora Ali.",
          },
          {
            pathname: "/politica-de-privacidade",
            title: "Política de Privacidade — Bora Ali",
            description: "Saiba como o Bora Ali coleta, usa e protege seus dados pessoais.",
          },
          {
            pathname: "/termos-de-uso",
            title: "Termos de Uso — Bora Ali",
            description: "Leia os termos e condições de uso do Bora Ali.",
          },
        ],
      }),
    ],
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
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov"],
        exclude: [
          "**/node_modules/**",
          "**/dist/**",
          "src/test/**",
          "**/*.d.ts",
          "**/vite.config.*",
        ],
        thresholds: {
          lines: 50,
          functions: 50,
          branches: 50,
          statements: 50,
        },
      },
    },
  };
});
