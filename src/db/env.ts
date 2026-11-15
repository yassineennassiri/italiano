/**
 * Which Neon branch to talk to. `DATABASE_URL` is the `main` branch (real
 * progress); `DATABASE_URL_TEST` is the `dev` branch (experiments, Playwright,
 * the database tests). Both live in `.env.local`, never in git (SPEC §8).
 */
import fs from "node:fs";
import path from "node:path";

type Env = Record<string, string | undefined>;

/** The connection string for the chosen branch. Throws when it isn't set. */
export function databaseUrl(env: Env = process.env, { test = false } = {}): string {
  const name = test ? "DATABASE_URL_TEST" : "DATABASE_URL";
  const url = env[name]?.trim();
  if (!url) {
    throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in.`);
  }
  return url;
}

/**
 * Loads `.env.local` into `process.env` for code that runs outside Next.js
 * (the db scripts and the database tests). Does nothing when the file is
 * missing, as in CI.
 */
export function loadLocalEnv(projectDir = process.cwd()): void {
  const file = path.join(projectDir, ".env.local");
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
