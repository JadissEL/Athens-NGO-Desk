// @ts-check
const { defineConfig } = require("@playwright/test");

const port = process.env.E2E_STATIC_PORT || "8765";
const baseURL = process.env.E2E_STATIC_URL || `http://127.0.0.1:${port}`;

module.exports = defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: process.env.E2E_STATIC_URL
    ? undefined
    : {
        command: `npx -y serve static-site -l ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
