/**
 * The app's database client. `server-only` makes importing this from a Client
 * Component a build error, so the connection string never reaches the browser.
 */
import "server-only";
import { connect, type Db } from "./connect";
import { appBranch, databaseUrl } from "./env";

let client: Db | undefined;

/** The client for the app's branch (`DATABASE_URL`, or `DATABASE_URL_TEST` with `DB_BRANCH=dev`), created on first use. */
export function db(): Db {
  client ??= connect(databaseUrl(appBranch()));
  return client;
}
