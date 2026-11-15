import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

/** Tests that talk to the Neon `dev` branch. They run only with `npm run test:db`. */
export const dbTests = "src/**/*.db.test.ts";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: [...configDefaults.exclude, dbTests],
  },
});
