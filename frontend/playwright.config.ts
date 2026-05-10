import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command:
      "VITE_API_URL=http://localhost:8000/api npm run dev -- --host localhost --port 8181",
    url: "http://localhost:8181",
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:8181",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
