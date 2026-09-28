import { defineConfig, devices } from "@playwright/test";

// Override with PLAYWRIGHT_PORT to run the suite alongside a `next dev` server:
// reusing a dev server makes browser-issued POSTs fail its origin check.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: { baseURL, trace: "retain-on-failure" },

  // Snapshots are compared against a production build, which has no dev overlay
  // and no double rendering, so screenshots stay stable between runs.
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" } },

  webServer: {
    command: `node node_modules/next/dist/bin/next build && node node_modules/next/dist/bin/next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /visual\.spec\.ts/,
    },
    {
      // Android Chrome, which is what most of this audience actually browses on.
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testIgnore: /visual\.spec\.ts/,
    },
    {
      // Visual regression runs once, driving its own viewport sizes.
      name: "visual",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /visual\.spec\.ts/,
    },
  ],
});
