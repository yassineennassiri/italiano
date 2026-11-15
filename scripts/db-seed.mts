/**
 * `npm run db:seed`: creates the fixed-UUID profile on the main branch
 * (DATABASE_URL), or on the dev branch with `npm run db:seed -- --test`.
 * Safe to run again: an existing profile is left as it is.
 */
import { connect } from "../src/db/connect";
import { databaseUrl, loadLocalEnv } from "../src/db/env";
import { PROFILE_ID, seedProfile } from "../src/db/seed";

loadLocalEnv();
const test = process.argv.includes("--test");
await seedProfile(connect(databaseUrl(process.env, { test })));
console.log(`db:seed: profile ${PROFILE_ID} is on the ${test ? "dev" : "main"} branch.`);
