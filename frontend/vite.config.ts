import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
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
  const isProd = appEnv === "production" || appEnv === "prod";
  const externalDebugHosts =
    appEnv === "preprod" ? [".ngrok-free.app", ".ngrok-free.dev"] : [];

  return {
    plugins: [
      tailwindcss(),
      react(),
      ...(isProd ? [aeoVitePlugin({
        title: "Boora Ali",
        description:
          "Diário pessoal de lugares — registre lugares, visitas e experiências que valem lembrar",
        url: "https://booraali.com.br",
        // robots.txt gerado manualmente em public/robots.txt (allow-all).
        // Desliga o gerador do aeo pra não sobrescrever com lista verbosa.
        generators: { robotsTxt: false },
        pages: [
          {
            pathname: "/",
            title: "Boora Ali — Diário pessoal de lugares",
            description: "Salve lugares, registre visitas e guarde o que vale lembrar em um diário pessoal de lugares.",
          },
          {
            pathname: "/politica-de-privacidade",
            title: "Política de Privacidade — Boora Ali",
            description: "Saiba como o Boora Ali coleta, usa e protege seus dados pessoais.",
          },
          {
            pathname: "/termos-de-uso",
            title: "Termos de Uso — Boora Ali",
            description: "Leia os termos e condições de uso do Boora Ali.",
          },
        ],
      })] : []),
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
          branches: 45,
          statements: 50,
        },
      },
    },
  };
});
