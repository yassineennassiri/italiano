/**
 * `npm run db:migrate`: applies the migrations under drizzle/ to the main
 * branch (DATABASE_URL). `npm run db:migrate -- --test` targets the dev branch
 * (DATABASE_URL_TEST). Run it once per branch, and again after pulling new
 * migrations.
 */
import { connect } from "../src/db/connect";
import { branchFromArgs, databaseUrl, loadLocalEnv } from "../src/db/env";
import { migrateDatabase } from "../src/db/migrate";

loadLocalEnv();
const branch = branchFromArgs(process.argv);
await migrateDatabase(connect(databaseUrl(branch)));
console.log(`db:migrate: ${branch} branch is up to date.`);
