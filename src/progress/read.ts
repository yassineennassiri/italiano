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
import type { ExerciseEntry } from "@/items/entry";
import { loadLastLocation, loadLessonEntries } from "./store";

/** Exercise id → stored entry, for every exercise of the lesson with a state that still fits its content. */
export async function readLessonEntries(lesson: Lesson): Promise<Record<string, ExerciseEntry>> {
  await connection();
  try {
    return Object.fromEntries(await loadLessonEntries(db(), PROFILE_ID, lesson));
  } catch (error) {
    console.error("Could not load progress; the lesson opens without it.", error);
    return {};
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
