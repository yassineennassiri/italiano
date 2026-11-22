/** `npm run test:db`: only the tests that talk to the Neon `dev` branch. */
import { configDefaults, defineConfig } from "vitest/config";
import base, { dbTests } from "./vitest.config.mjs";

export default defineConfig({
  ...base,
  // One file at a time: each applies the migrations first, and two at once would race on a fresh branch.
  test: { ...base.test, include: [dbTests], exclude: configDefaults.exclude, testTimeout: 60_000, fileParallelism: false },
});
