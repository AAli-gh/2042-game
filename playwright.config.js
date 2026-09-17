const {defineConfig, devices} = require("@playwright/test");

/** CHROMIUM_PATH lets a sandbox with a preinstalled browser skip `playwright install`. */
const executablePath = process.env.CHROMIUM_PATH || undefined;

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8765",
    trace: "on-first-retry"
  },
  projects: [
    {name: "phone", use: {...devices["Pixel 5"], launchOptions: {executablePath}}}
  ],
  webServer: {
    command: "python3 -m http.server 8765 --bind 127.0.0.1",
    url: "http://127.0.0.1:8765/index.html",
    reuseExistingServer: !process.env.CI
  }
});
