import type { Db } from "./connect";
import { profile } from "./schema";

/** The one learner. There is no login: every request uses this profile (SPEC §8, §10.1). */
export const PROFILE_ID = "00000000-0000-4000-8000-000000000001";

/** Creates the profile row if it's missing. Safe to run any number of times. */
export async function seedProfile(db: Db): Promise<void> {
  await db.insert(profile).values({ id: PROFILE_ID, displayName: "Io" }).onConflictDoNothing({ target: profile.id });
}
