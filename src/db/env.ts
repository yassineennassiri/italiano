/**
 * Which Neon branch to talk to. `main` holds real progress (`DATABASE_URL`);
 * `dev` is for experiments, Playwright and the database tests
 * (`DATABASE_URL_TEST`). Both live in `.env.local`, never in git (SPEC §8).
 */
import fs from "node:fs";
import path from "node:path";

export type Branch = "main" | "dev";

type Env = Record<string, string | undefined>;

const VARIABLE: Record<Branch, string> = { main: "DATABASE_URL", dev: "DATABASE_URL_TEST" };

/** The connection string for a branch. Throws when it isn't set. */
export function databaseUrl(branch: Branch = "main", env: Env = process.env): string {
  const name = VARIABLE[branch];
  const url = env[name]?.trim();
  if (!url) {
    throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in.`);
  }
  return url;
}

/** The branch a db script targets: `dev` with `--test`, otherwise `main`. */
export function branchFromArgs(args: readonly string[]): Branch {
  return args.includes("--test") ? "dev" : "main";
}

/**
 * Loads `.env.local` into `process.env` for code that runs outside Next.js
 * (the db scripts and the database tests). Does nothing when the file is
 * missing.
 */
export function loadLocalEnv(): void {
  const file = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
