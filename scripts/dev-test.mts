/**
 * `npm run dev:test`: the dev server on port 3001 against the Neon `dev` branch
 * (`DATABASE_URL_TEST`), for trying things out without touching real progress.
 * It shares `.next/` with `npm run dev`, so run one or the other.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev", "--port", "3001"], {
  stdio: "inherit",
  env: { ...process.env, DB_BRANCH: "dev" },
});
child.on("exit", (code) => process.exit(code ?? 0));
