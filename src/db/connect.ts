/**
 * A Drizzle client over Neon's HTTP driver: HTTPS on port 443, which a
 * locked-down work network is likely to allow (ADR-0001). The app gets its
 * client from `@/db`; the db scripts and tests call `connect` directly.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function connect(url: string) {
  return drizzle({ client: neon(url), schema });
}

export type Db = ReturnType<typeof connect>;
