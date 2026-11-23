/**
 * The synced settings in `profile.settings` (SPEC §10.1). A write merges its
 * keys into the stored ones, so the other settings, and any key a later
 * milestone adds, stay as they are.
 */
import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/connect";
import { profile } from "@/db/schema";
import type { WriteResponse } from "@/progress/store";
import { parseSettings, type Settings, type SettingsWrite } from "./settings";

/** The profile's settings, with the defaults for any not set. */
export async function loadSettings(db: Db, userId: string): Promise<Settings> {
  const [row] = await db.select({ settings: profile.settings }).from(profile).where(eq(profile.id, userId));
  return parseSettings(row?.settings);
}

/** Merges a settings change into the profile's settings; "ignored" when there is no such profile. */
export async function saveSettings(db: Db, userId: string, write: SettingsWrite): Promise<WriteResponse> {
  const updated = await db
    .update(profile)
    .set({ settings: sql`${profile.settings} || ${JSON.stringify(write)}::jsonb` })
    .where(eq(profile.id, userId))
    .returning({ id: profile.id });
  return { result: updated.length > 0 ? "saved" : "ignored" };
}
