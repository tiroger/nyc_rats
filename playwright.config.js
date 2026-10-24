import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173/nyc_rats/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
        ...(process.env.PLAYWRIGHT_CHROME_PATH
          ? {
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROME_PATH,
              },
            }
          : {}),
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        ...(process.env.PLAYWRIGHT_CHROME_PATH
          ? {
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROME_PATH,
              },
            }
          : {}),
      },
    },
  ],
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/nyc_rats/",
    reuseExistingServer: !process.env.CI,
  },
});
