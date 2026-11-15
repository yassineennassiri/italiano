/**
 * Runs against the Neon `dev` branch (`DATABASE_URL_TEST` in `.env.local`).
 * CI has no database secret (ADR-0001), so there this suite is skipped.
 */
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { connect } from "./connect";
import { databaseUrl, loadLocalEnv } from "./env";
import { migrateDatabase } from "./migrate";
import { profile } from "./schema";
import { PROFILE_ID, seedProfile } from "./seed";

loadLocalEnv();
const testUrl = process.env.DATABASE_URL_TEST?.trim();

describe.skipIf(!testUrl)("database on the dev branch", { timeout: 60_000 }, () => {
  const db = connect(databaseUrl(process.env, { test: true }));

  it("applies the migrations, and applying them again changes nothing", async () => {
    await migrateDatabase(db);
    await expect(migrateDatabase(db)).resolves.toBeUndefined();
  });

  it("db:seed creates the fixed-UUID profile once, however often it runs", async () => {
    await seedProfile(db);
    await seedProfile(db);

    const rows = await db.select().from(profile).where(eq(profile.id, PROFILE_ID));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("00000000-0000-4000-8000-000000000001");
  });
});
