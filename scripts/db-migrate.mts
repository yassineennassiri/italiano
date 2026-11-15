/**
 * `npm run db:migrate`: applies the migrations under drizzle/ to the main
 * branch (DATABASE_URL). `npm run db:migrate -- --test` targets the dev branch
 * (DATABASE_URL_TEST). Run it once per branch, and again after pulling new
 * migrations.
 */
import { connect } from "../src/db/connect";
import { databaseUrl, loadLocalEnv } from "../src/db/env";
import { migrateDatabase } from "../src/db/migrate";

loadLocalEnv();
const test = process.argv.includes("--test");
await migrateDatabase(connect(databaseUrl(process.env, { test })));
console.log(`db:migrate: ${test ? "dev" : "main"} branch is up to date.`);
