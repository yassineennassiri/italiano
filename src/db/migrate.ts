import path from "node:path";
import { migrate } from "drizzle-orm/neon-http/migrator";
import type { Db } from "./connect";

/** Where `npm run db:generate` writes the SQL migrations (see drizzle.config.ts). */
export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

/**
 * Applies the SQL migrations the database hasn't seen yet. The HTTP driver has
 * no transactions, so a migration that fails halfway is not rolled back.
 */
export async function migrateDatabase(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}
