import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 2,
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run start --workspace apps/web",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: "npm run start:admin",
      url: "http://localhost:3001/auth",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
  reporter: [["list"]],
});
