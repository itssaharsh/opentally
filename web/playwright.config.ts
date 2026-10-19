import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: /.*\.spec\.ts/, timeout: 240_000, expect: { timeout: 15_000 }, retries: 0, workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.BASE_URL ?? "http://127.0.0.1:3471", viewport: { width: 1440, height: 900 }, trace: "retain-on-failure" },
  webServer: process.env.BASE_URL ? undefined : { command: "npm run build && DEMO_LIMITS=off npm run start -- --port 3471", timeout: 300_000, url: "http://127.0.0.1:3471/api/state", reuseExistingServer: true },
});
