/**
 * Reading and writing progress in Neon (SPEC §10.2–10.4). Takes the client as
 * a parameter: the server actions pass `db()`, the database tests the `dev`
 * branch. The HTTP driver has no interactive transactions, so each write is
 * read-plan-write: one batch of reads, a pure plan (`plan.ts`), one batch of writes.
 */
import { and, desc, eq, min } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { exerciseHashes } from "@/content/hash";
import { loadLesson } from "@/content/load";
import type { Lesson } from "@/content/schema";
import type { Db } from "@/db/connect";
import { errorLog, exerciseAttempt, itemState, lessonProgress } from "@/db/schema";
import type { SavedEntry } from "./merge";
import {
  type CorrectionWrite,
  type ExerciseWrite,
  type FinishWrite,
  planCorrection,
  planExerciseWrite,
  planFinish,
  restoreEntries,
  type StoredItemRow,
  type VisitWrite,
} from "./plan";

/** What a write did, and the exercise's entry as now saved (none when nothing fitting is stored). */
export type WriteResponse = { result: "saved" | "ignored"; saved?: SavedEntry };

/** What Correggi i miei errori did, and the reopened entries as now saved, by exercise id. */
export type CorrectionResponse = { result: "saved" | "ignored"; saved?: Record<string, SavedEntry> };

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

/** The lesson_progress fields a plan reads. */
const storedProgress = (db: Db, userId: string, lessonId: string) =>
  db
    .select({
      status: lessonProgress.status,
      startedAt: lessonProgress.startedAt,
      completedAt: lessonProgress.completedAt,
      bestPercent: lessonProgress.bestPercent,
    })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)));

type ItemStateRow = Omit<typeof itemState.$inferInsert, "userId">;
type ProgressRow = Omit<typeof lessonProgress.$inferInsert, "userId">;

// The update sets also rewrite the key columns, to the values they already have.
const upsertItemState = (db: Db, userId: string, row: ItemStateRow) =>
  db
    .insert(itemState)
    .values({ ...row, userId })
    .onConflictDoUpdate({ target: [itemState.userId, itemState.itemId], set: row });

const upsertProgress = (db: Db, userId: string, row: ProgressRow) =>
  db
    .insert(lessonProgress)
    .values({ ...row, userId })
    .onConflictDoUpdate({ target: [lessonProgress.userId, lessonProgress.lessonId], set: row });

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

/** One lesson's progress, for the level overview and Home (SPEC §3.2, §3.3). */
export type ProgressSummary = Pick<
  typeof lessonProgress.$inferSelect,
  "lessonId" | "status" | "bestPercent" | "lastLocation" | "updatedAt"
>;

/** Every lesson the learner has opened, most recently changed first. */
export async function loadProgressSummaries(db: Db, userId: string): Promise<ProgressSummary[]> {
  return db
    .select({
      lessonId: lessonProgress.lessonId,
      status: lessonProgress.status,
      bestPercent: lessonProgress.bestPercent,
      lastLocation: lessonProgress.lastLocation,
      updatedAt: lessonProgress.updatedAt,
    })
    .from(lessonProgress)
    .where(eq(lessonProgress.userId, userId))
    .orderBy(desc(lessonProgress.updatedAt));
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

  const [rows, [progress], [seen], [firstCheck]] = await db.batch([
    lessonRows(db, userId, lesson.id),
    storedProgress(db, userId, lesson.id),
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

  const writes: BatchItem<"pg">[] = [
    db.insert(exerciseAttempt).values({ ...plan.attempt, userId }),
    upsertItemState(db, userId, plan.itemState),
    upsertProgress(db, userId, plan.progress),
  ];
  if (plan.errors.length > 0) writes.push(db.insert(errorLog).values(plan.errors.map((row) => ({ ...row, userId }))));
  await db.batch(writes as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return { result: "saved", saved: { entry: plan.entry, savedAt: now.toISOString() } };
}

/**
 * Correggi i miei errori (SPEC §4.4): reopens the lesson's wrong and solved
 * scorable items as stored now. "ignored" when there is nothing to reopen, so
 * a retried request changes nothing.
 */
export async function saveCorrection(db: Db, userId: string, write: CorrectionWrite, now = new Date()): Promise<CorrectionResponse> {
  const lesson = loadLesson(write.lessonId);
  if (!lesson) return { result: "ignored" };
  const [rows, [progress]] = await db.batch([lessonRows(db, userId, lesson.id), storedProgress(db, userId, lesson.id)]);
  const plan = planCorrection({ lesson, hashes: exerciseHashes(lesson), rows, progress, at: write.at, now });
  if (!plan) return { result: "ignored", saved: {} };

  await db.batch([
    db.insert(exerciseAttempt).values(plan.attempts.map((row) => ({ ...row, userId }))),
    ...plan.itemStates.map((row) => upsertItemState(db, userId, row)),
    upsertProgress(db, userId, plan.progress),
  ]);
  const savedAt = now.toISOString();
  return { result: "saved", saved: Object.fromEntries([...plan.entries].map(([id, entry]) => [id, { entry, savedAt }])) };
}

/** Reaching the Finish screen completes the lesson (SPEC §4.9). */
export async function saveFinish(db: Db, userId: string, write: FinishWrite, now = new Date()): Promise<WriteResponse> {
  const lesson = loadLesson(write.lessonId);
  if (!lesson) return { result: "ignored" };
  const [rows, [progress]] = await db.batch([lessonRows(db, userId, lesson.id), storedProgress(db, userId, lesson.id)]);
  await upsertProgress(db, userId, planFinish({ lesson, hashes: exerciseHashes(lesson), rows, progress, now }));
  return { result: "saved" };
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
