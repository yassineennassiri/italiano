/**
 * Reading and writing progress in Neon (SPEC §10.2–10.4). Takes the client as
 * a parameter: the server actions pass `db()`, the database tests the `dev`
 * branch. The HTTP driver has no interactive transactions, so each write is
 * read-plan-write: one batch of reads, `planExerciseWrite`, one batch of writes.
 */
import { and, eq, min } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { exerciseHashes } from "@/content/hash";
import { loadLesson } from "@/content/load";
import type { Lesson } from "@/content/schema";
import type { Db } from "@/db/connect";
import { errorLog, exerciseAttempt, itemState, lessonProgress } from "@/db/schema";
import type { SavedEntry } from "./merge";
import { type ExerciseWrite, planExerciseWrite, restoreEntries, type StoredItemRow, type VisitWrite } from "./plan";

/** What a write did, and the exercise's entry as now saved (none when nothing fitting is stored). */
export type WriteResponse = { result: "saved" | "ignored"; saved?: SavedEntry };

const storedRowColumns = {
  itemId: itemState.itemId,
  status: itemState.status,
  firstCheckCorrect: itemState.firstCheckCorrect,
  points: itemState.points,
  answer: itemState.answer,
  contentHash: itemState.contentHash,
  updatedAt: itemState.updatedAt,
};

const lessonRows = (db: Db, userId: string, lessonId: string) =>
  db.select(storedRowColumns).from(itemState).where(and(eq(itemState.userId, userId), eq(itemState.lessonId, lessonId)));

/** The stored entries that still fit the lesson's content, each with when it was saved. */
function savedEntries(lesson: Lesson, rows: readonly (StoredItemRow & { updatedAt: Date })[]): Map<string, SavedEntry> {
  const savedAt = new Map(rows.map((row) => [row.itemId, row.updatedAt.toISOString()]));
  const entries = restoreEntries(lesson, exerciseHashes(lesson), rows);
  return new Map([...entries].map(([id, entry]) => [id, { entry, savedAt: savedAt.get(id)! }]));
}

/** The lesson's stored exercise entries that still fit its content. */
export async function loadLessonEntries(db: Db, userId: string, lesson: Lesson): Promise<Map<string, SavedEntry>> {
  return savedEntries(lesson, await lessonRows(db, userId, lesson.id));
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
 * exercise, is for since-changed content, or was already applied (a retry after
 * a lost response). Two tabs replaying the same write at the same moment both
 * pass the check; the attempt's primary key then fails one batch, and its retry
 * comes back "ignored".
 */
export async function saveExerciseWrite(db: Db, userId: string, write: ExerciseWrite, now = new Date()): Promise<WriteResponse> {
  const lesson = loadLesson(write.lessonId);
  if (!lesson) return { result: "ignored" };
  const progressWhere = and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lesson.id));

  const [rows, [progress], [seen], [firstCheck]] = await db.batch([
    lessonRows(db, userId, lesson.id),
    db
      .select({ status: lessonProgress.status, startedAt: lessonProgress.startedAt, bestPercent: lessonProgress.bestPercent })
      .from(lessonProgress)
      .where(progressWhere),
    db.select({ id: exerciseAttempt.id }).from(exerciseAttempt).where(eq(exerciseAttempt.id, write.eventId)),
    db
      .select({ at: min(exerciseAttempt.createdAt) })
      .from(exerciseAttempt)
      .where(
        and(eq(exerciseAttempt.userId, userId), eq(exerciseAttempt.itemId, write.exerciseId), eq(exerciseAttempt.action, "check")),
      ),
  ]);
  const ignored = (): WriteResponse => ({ result: "ignored", saved: savedEntries(lesson, rows).get(write.exerciseId) });
  if (seen) return ignored();

  const plan = planExerciseWrite({
    lesson,
    hashes: exerciseHashes(lesson),
    rows,
    progress,
    firstCheckAt: firstCheck?.at ?? null,
    action: write,
    now,
  });
  if (!plan) return ignored();

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
  return { result: "saved", saved: { entry: plan.entry, savedAt: now.toISOString() } };
}

/** Records the step the learner is on, so reopening the lesson resumes there. */
export async function saveVisit(db: Db, userId: string, visit: VisitWrite, now = new Date()): Promise<WriteResponse> {
  const lesson = loadLesson(visit.lessonId);
  if (!lesson) return { result: "ignored" };
  await db
    .insert(lessonProgress)
    .values({ userId, lessonId: lesson.id, contentVersion: lesson.version, lastLocation: visit.location, updatedAt: now })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: { lastLocation: visit.location, updatedAt: now },
    });
  return { result: "saved" };
}
