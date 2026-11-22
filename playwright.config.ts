/**
 * `npm run test:e2e`: the happy path through the example lesson (issue #18),
 * focus return from the Azzera dialogs (issue #36) and A2.1.2's reading and
 * image_choice steps (issue #38), its audio steps (issue #39), its
 * word_bank step (issue #40) and its audio_gap step (issue #41), against the
 * Neon `dev` branch only (ADR-0001, SPEC §12). It starts
 * `npm run dev:test` on port 3001, or reuses one that is already running;
 * `e2e/global-setup.ts` refuses to go on unless the app says it uses `dev`.
 * `npm run dev` shares `.next/` with it, so stop that first.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = 3001;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // One profile: tests that write progress would fight over the same rows.
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
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Cloud sessions have Chrome for Testing at $CHROME_PATH and can't download
        // Playwright's own browser. Locally it's unset, so Playwright's Chromium is used.
        launchOptions: { executablePath: process.env.CHROME_PATH || undefined },
      },
    },
  ],
  webServer: {
    command: "npm run dev:test",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    // The first request compiles the app.
    timeout: 180_000,
  },
});
