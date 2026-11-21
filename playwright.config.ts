/**
 * `npm run test:e2e`: the happy path through the example lesson (issue #18),
 * locally only, against the Neon `dev` branch (ADR-0001, SPEC §12). It starts
 * `npm run dev:test` on port 3001, or reuses one that is already running; the
 * test itself refuses to run unless the app says it uses `dev`.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = 3001;

export default defineConfig({
  testDir: "e2e",
  // One lesson, one profile: tests would fight over the same rows.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev:test",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    // The first request compiles the app.
    timeout: 180_000,
  },
});
