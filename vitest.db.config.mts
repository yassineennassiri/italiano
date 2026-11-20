/** `npm run test:db`: only the tests that talk to the Neon `dev` branch. */
import { configDefaults, defineConfig } from "vitest/config";
import base, { dbTests } from "./vitest.config.mjs";

export default defineConfig({
  ...base,
  // One file at a time: they share the dev branch, and some count rows other files create.
  test: { ...base.test, include: [dbTests], exclude: configDefaults.exclude, testTimeout: 60_000, fileParallelism: false },
});
