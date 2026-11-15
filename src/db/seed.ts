import type { Db } from "./connect";
import { PROFILE_ID, profile } from "./schema";

/** Creates the fixed-UUID profile if it's missing. Safe to run any number of times. */
export async function seedProfile(db: Db): Promise<void> {
  await db.insert(profile).values({ id: PROFILE_ID, displayName: "Io" }).onConflictDoNothing({ target: profile.id });
}
