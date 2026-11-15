/**
 * `npm run test:db`: runs against the Neon `dev` branch (`DATABASE_URL_TEST`
 * in `.env.local`). Kept out of `npm test`, which stays offline, and out of CI,
 * which has no database secret (SPEC §8, ADR-0001).
 */
import { expect, it } from "vitest";
import { connect } from "./connect";
import { databaseUrl, loadLocalEnv } from "./env";
import { migrateDatabase } from "./migrate";
import { profile } from "./schema";
import { seedProfile } from "./seed";

loadLocalEnv();
const db = connect(databaseUrl("dev"));

it("applies the migrations, and running them again does not fail", async () => {
  await migrateDatabase(db);
  await expect(migrateDatabase(db)).resolves.toBeUndefined();
});

it("db:seed leaves exactly one profile with the fixed UUID, however often it runs", async () => {
  await seedProfile(db);
  await seedProfile(db);

  const rows = await db.select({ id: profile.id }).from(profile);
  expect(rows).toEqual([{ id: "00000000-0000-4000-8000-000000000001" }]);
});
