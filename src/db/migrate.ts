import path from "node:path";
import { migrate } from "drizzle-orm/neon-http/migrator";
import type { Db } from "./connect";

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

/**
 * Applies the SQL migrations under `drizzle/` that the database hasn't seen
 * yet. The HTTP driver has no transactions, so a migration that fails halfway
 * is not rolled back.
 */
export async function migrateDatabase(db: Db, migrationsFolder = MIGRATIONS_DIR): Promise<void> {
  await migrate(db, { migrationsFolder });
}
