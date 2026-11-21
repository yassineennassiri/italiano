/**
 * Runs once before any e2e test, after the dev server is up: refuses to go on
 * unless the app talks to the Neon `dev` branch (ADR-0001), so no test can
 * ever write to the real progress on `main`. The root layout renders the
 * branch as `data-db-branch` on `<html>`.
 */
import type { FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0].use.baseURL!;
  const html = await (await fetch(baseURL)).text();
  const branch = /<html[^>]*\sdata-db-branch="([^"]*)"/.exec(html)?.[1];
  if (branch !== "dev") {
    throw new Error(
      `The app at ${baseURL} uses the "${branch ?? "unknown"}" database branch, not "dev". ` +
        "Stop it and let Playwright start `npm run dev:test`.",
    );
  }
}
