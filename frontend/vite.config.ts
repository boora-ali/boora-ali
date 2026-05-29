import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { aeoVitePlugin } from "aeo.js/vite";
import path from "path";
import VitePluginPrerender from "@prerenderer/rollup-plugin";
import PuppeteerRenderer from "@prerenderer/renderer-puppeteer";

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
        pages: [
          {
            pathname: "/",
            title: "Boora Ali — Diário pessoal de lugares",
            description: "Salve lugares, registre visitas e guarde o que vale lembrar em um diário pessoal de lugares.",
          },
          {
            pathname: "/register",
            title: "Boora Ali — Crie sua conta",
            description: "Comece a registrar seus lugares favoritos gratuitamente. Crie sua conta no Boora Ali.",
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
      ...(isProd ? [
        // NOTE: "/" route is excluded — Vite 8 (Rolldown) does not correctly
        // re-emit index.html when the prerender plugin replaces it, causing
        // the root index.html to be deleted from dist. Sub-routes work fine.
        VitePluginPrerender({
          routes: ["/register", "/politica-de-privacidade", "/termos-de-uso"],
          renderer: new PuppeteerRenderer({
            headless: true,
            renderAfterTime: 2000,
          }),
        }),
      ] : []),
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
