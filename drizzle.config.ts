/**
 * drizzle-kit config, used only by `npm run db:generate` to turn
 * `src/db/schema.ts` into SQL migrations under `drizzle/`. Generating needs
 * no database; `npm run db:migrate` applies the migrations.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
