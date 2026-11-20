/**
 * Reading and writing progress in Neon (SPEC §10.2–10.4). Takes the client as
 * a parameter: the server actions pass `db()`, the database tests the `dev`
 * branch. The HTTP driver has no interactive transactions, so each write is
 * read-plan-write: one batch of reads, `planExerciseWrite`, one batch of writes.
 */
import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { exerciseHashes } from "@/content/hash";
import { loadLesson } from "@/content/load";
import type { Lesson } from "@/content/schema";
import type { Db } from "@/db/connect";
import { errorLog, exerciseAttempt, itemState, lessonProgress } from "@/db/schema";
import type { ExerciseEntry } from "@/items/entry";
import { type ExerciseWrite, planExerciseWrite, restoreEntries } from "./plan";

/** A visit to a lesson page, for resuming there (`last_location`). */
export type VisitWrite = { lessonId: string; location: string };

const storedRowColumns = {
  itemId: itemState.itemId,
  status: itemState.status,
  firstCheckCorrect: itemState.firstCheckCorrect,
  points: itemState.points,
  answer: itemState.answer,
  contentHash: itemState.contentHash,
};

const lessonRows = (db: Db, userId: string, lessonId: string) =>
  db.select(storedRowColumns).from(itemState).where(and(eq(itemState.userId, userId), eq(itemState.lessonId, lessonId)));

/** The lesson's stored exercise entries that still fit its content. */
export async function loadLessonEntries(db: Db, userId: string, lesson: Lesson): Promise<Map<string, ExerciseEntry>> {
  return restoreEntries(lesson, exerciseHashes(lesson), await lessonRows(db, userId, lesson.id));
}

/** Where the learner last was in the lesson, e.g. `esercizi/3`, or null. */
export async function loadLastLocation(db: Db, userId: string, lessonId: string): Promise<string | null> {
  const [row] = await db
    .select({ lastLocation: lessonProgress.lastLocation })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)));
  return row?.lastLocation ?? null;
}

/**
 * Applies one learner action. "ignored" when it changes nothing, names no
 * exercise, or was already applied (a retry after a lost response).
 */
export async function saveExerciseWrite(db: Db, userId: string, write: ExerciseWrite, now = new Date()): Promise<"saved" | "ignored"> {
  const lesson = loadLesson(write.lessonId);
  if (!lesson) return "ignored";
  const progressWhere = and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lesson.id));

  const [rows, [progress], [seen]] = await db.batch([
    lessonRows(db, userId, lesson.id),
    db
      .select({ status: lessonProgress.status, startedAt: lessonProgress.startedAt, bestPercent: lessonProgress.bestPercent })
      .from(lessonProgress)
      .where(progressWhere),
    db.select({ id: exerciseAttempt.id }).from(exerciseAttempt).where(eq(exerciseAttempt.id, write.eventId)),
  ]);
  if (seen) return "ignored";

  const plan = planExerciseWrite({ lesson, hashes: exerciseHashes(lesson), rows, progress, action: write, now });
  if (!plan) return "ignored";

  // The update sets also rewrite the key columns, to the values they already have.
  const writes: BatchItem<"pg">[] = [
    db.insert(exerciseAttempt).values({ ...plan.attempt, userId }),
    db
      .insert(itemState)
      .values({ ...plan.itemState, userId })
      .onConflictDoUpdate({ target: [itemState.userId, itemState.itemId], set: plan.itemState }),
    db
      .insert(lessonProgress)
      .values({ ...plan.progress, userId })
      .onConflictDoUpdate({ target: [lessonProgress.userId, lessonProgress.lessonId], set: plan.progress }),
  ];
  if (plan.errors.length > 0) writes.push(db.insert(errorLog).values(plan.errors.map((row) => ({ ...row, userId }))));
  await db.batch(writes as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return "saved";
}

/** Records the page the learner is on, so reopening the lesson resumes there. */
export async function saveVisit(db: Db, userId: string, visit: VisitWrite, now = new Date()): Promise<"saved" | "ignored"> {
  const lesson = loadLesson(visit.lessonId);
  if (!lesson) return "ignored";
  await db
    .insert(lessonProgress)
    .values({ userId, lessonId: lesson.id, contentVersion: lesson.version, lastLocation: visit.location, updatedAt: now })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: { lastLocation: visit.location, updatedAt: now },
    });
  return "saved";
}
