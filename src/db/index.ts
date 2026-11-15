/**
 * The app's database client. `server-only` makes importing this from a Client
 * Component a build error, so the connection string never reaches the browser.
 */
import "server-only";
import { connect, type Db } from "./connect";
import { databaseUrl } from "./env";

let client: Db | undefined;

/** The client for `DATABASE_URL`, created on first use. */
export function db(): Db {
  client ??= connect(databaseUrl());
  return client;
}
