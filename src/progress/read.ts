/**
 * Progress reads for Server Components. They run at request time, never at
 * build time, and fail soft: when Neon is unreachable (a locked-down network,
 * SPEC §12) the lesson still opens, just without the saved state.
 */
import "server-only";
import { connection } from "next/server";
import type { Lesson } from "@/content/schema";
import { db } from "@/db";
import { PROFILE_ID } from "@/db/schema";
import type { SavedEntry } from "./merge";
import { type DueCard, loadDueCards, loadItemCardRefs, loadTopErrorTags } from "@/review/store";
import type { TopTag } from "@/review/top-tags";
import { loadLastLocation, loadLessonEntries, loadProgressSummaries, type ProgressSummary } from "./store";

/** Every lesson's progress, most recently changed first; empty when the database is unreachable. */
export async function readProgressSummaries(): Promise<ProgressSummary[]> {
  await connection();
  try {
    return await loadProgressSummaries(db(), PROFILE_ID);
  } catch (error) {
    console.error("Could not load progress; every lesson shows as not started.", error);
    return [];
  }
}

/** The lesson's saved entries by exercise id; `loaded` is false when the database couldn't be read. */
export async function readLessonEntries(lesson: Lesson): Promise<{ saved: Record<string, SavedEntry>; loaded: boolean }> {
  await connection();
  try {
    return { saved: Object.fromEntries(await loadLessonEntries(db(), PROFILE_ID, lesson)), loaded: true };
  } catch (error) {
    console.error("Could not load progress; the lesson opens without it.", error);
    return { saved: {}, loaded: false };
  }
}

/** The last visited location in the lesson, or null (also when the database is unreachable). */
export async function readLastLocation(lessonId: string): Promise<string | null> {
  await connection();
  try {
    return await loadLastLocation(db(), PROFILE_ID, lessonId);
  } catch (error) {
    console.error("Could not load the resume point; opening the intro.", error);
    return null;
  }
}

/** The item cards due now, most overdue first; `loaded` is false when the database couldn't be read. */
export async function readDueCards(): Promise<{ due: DueCard[]; loaded: boolean }> {
  await connection();
  try {
    return { due: await loadDueCards(db(), PROFILE_ID, new Date()), loaded: true };
  } catch (error) {
    console.error("Could not load the due review cards.", error);
    return { due: [], loaded: false };
  }
}

/** The top 5 error tags of the last 30 days; `loaded` is false when the database couldn't be read. */
export async function readTopErrorTags(): Promise<{ top: TopTag[]; loaded: boolean }> {
  await connection();
  try {
    return { top: await loadTopErrorTags(db(), PROFILE_ID, new Date()), loaded: true };
  } catch (error) {
    console.error("Could not load the top error tags.", error);
    return { top: [], loaded: false };
  }
}

/**
 * What a tag drill picks from: every lesson's progress, and the exercises
 * that have an item card; `loaded` is false when the database couldn't be read.
 */
export async function readDrillSources(): Promise<{ progress: ProgressSummary[]; carded: Set<string>; loaded: boolean }> {
  await connection();
  try {
    const [progress, carded] = await Promise.all([loadProgressSummaries(db(), PROFILE_ID), loadItemCardRefs(db(), PROFILE_ID)]);
    return { progress, carded, loaded: true };
  } catch (error) {
    console.error("Could not load the lessons for a tag drill.", error);
    return { progress: [], carded: new Set(), loaded: false };
  }
}
