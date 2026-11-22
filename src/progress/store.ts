/**
 * Reading and writing progress in Neon (SPEC §10.2–10.4). Takes the client as
 * a parameter: the server actions pass `db()`, the database tests the `dev`
 * branch. The HTTP driver has no interactive transactions, so each write is
 * read-plan-write: one batch of reads, a pure plan (`plan.ts`), one batch of writes.
 */
import { and, asc, count, desc, eq, inArray, lte, max, min } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { exerciseHashes } from "@/content/hash";
import { lessonIdOfExercise } from "@/content/ids";
import { loadCourse, loadLesson } from "@/content/load";
import type { Lesson } from "@/content/schema";
import type { Db } from "@/db/connect";
import { errorLog, exerciseAttempt, itemState, lessonProgress, reviewCard, reviewLog } from "@/db/schema";
import type { CardRow } from "@/review/item-card";
import { planReview, type ReviewWrite } from "@/review/plan";
import type { SavedEntry } from "./merge";
import {
  type CorrectionWrite,
  type ExerciseWrite,
  type FinishWrite,
  planCorrection,
  planExerciseWrite,
  planFinish,
  planReset,
  type ResetWrite,
  restoreEntries,
  type Row,
  type StoredItemRow,
  type VisitWrite,
} from "./plan";

/** What a write did, and the exercise's entry as now saved (none when nothing fitting is stored). */
export type WriteResponse = { result: "saved" | "ignored"; saved?: SavedEntry };

/** What Azzera did; `resetAt` is the server's time of the reset, comparable with `item_state.updated_at`. */
export type ResetResponse = { result: "saved"; resetAt: string } | { result: "ignored" };

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

// The update sets also rewrite the key columns, to the values they already have.
const upsertItemState = (db: Db, userId: string, row: Row<typeof itemState>) =>
  db
    .insert(itemState)
    .values({ ...row, userId })
    .onConflictDoUpdate({ target: [itemState.userId, itemState.itemId], set: row });

const upsertProgress = (db: Db, userId: string, row: Row<typeof lessonProgress>) =>
  db
    .insert(lessonProgress)
    .values({ ...row, userId })
    .onConflictDoUpdate({ target: [lessonProgress.userId, lessonProgress.lessonId], set: row });

/** The fields of a stored card that grading reads. */
const storedCardColumns = {
  id: reviewCard.id,
  refId: reviewCard.refId,
  intervalDays: reviewCard.intervalDays,
  ease: reviewCard.ease,
  reps: reviewCard.reps,
  lapses: reviewCard.lapses,
  streak: reviewCard.streak,
};

const itemCard = (db: Db, userId: string, exerciseId: string) =>
  db
    .select(storedCardColumns)
    .from(reviewCard)
    .where(and(eq(reviewCard.userId, userId), eq(reviewCard.kind, "item"), eq(reviewCard.refId, exerciseId)));

/** Creates the card, or regrades it when it exists: a concurrent create from the other computer keeps its id. */
const upsertCard = (db: Db, userId: string, { id, kind, refId, ...schedule }: CardRow) =>
  db
    .insert(reviewCard)
    .values({ id, kind, refId, ...schedule, userId })
    .onConflictDoUpdate({ target: [reviewCard.userId, reviewCard.kind, reviewCard.refId], set: schedule });

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

  const [rows, [progress], [seen], [firstCheck], [lastReset], [card]] = await db.batch([
    lessonRows(db, userId, lesson.id),
    storedProgress(db, userId, lesson.id),
    db.select({ id: exerciseAttempt.id }).from(exerciseAttempt).where(eq(exerciseAttempt.id, write.eventId)),
    db
      .select({ at: min(exerciseAttempt.createdAt) })
      .from(exerciseAttempt)
      .where(
        and(eq(exerciseAttempt.userId, userId), eq(exerciseAttempt.itemId, write.exerciseId), eq(exerciseAttempt.action, "check")),
      ),
    db
      .select({ at: max(exerciseAttempt.createdAt) })
      .from(exerciseAttempt)
      .where(
        and(eq(exerciseAttempt.userId, userId), eq(exerciseAttempt.itemId, write.exerciseId), eq(exerciseAttempt.action, "reset")),
      ),
    itemCard(db, userId, write.exerciseId),
  ]);
  const ignored = (): WriteResponse => ({ result: "ignored", saved: savedEntries(lesson, rows).get(write.exerciseId) });
  if (seen) return ignored();

  const plan = planExerciseWrite({
    lesson,
    hashes: exerciseHashes(lesson),
    rows,
    progress,
    firstCheckAt: firstCheck?.at ?? null,
    resetAt: lastReset?.at ?? null,
    card,
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
  if (plan.card) writes.push(upsertCard(db, userId, plan.card));
  await db.batch(writes as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return { result: "saved", saved: { entry: plan.entry, savedAt: now.toISOString() } };
}

/** The cards a review session can show: how many item cards are due, and the most overdue of them. */
export type DueCards = { total: number; cards: { id: string; refId: string }[] };

/** Item cards due by `now`, most overdue first, at most `limit` of them, and how many are due in all. */
export async function loadDueCards(db: Db, userId: string, now: Date, limit: number): Promise<DueCards> {
  const due = and(eq(reviewCard.userId, userId), eq(reviewCard.kind, "item"), lte(reviewCard.dueAt, now));
  const [[{ total }], cards] = await db.batch([
    db.select({ total: count() }).from(reviewCard).where(due),
    db.select({ id: reviewCard.id, refId: reviewCard.refId }).from(reviewCard).where(due).orderBy(asc(reviewCard.dueAt), asc(reviewCard.id)).limit(limit),
  ]);
  return { total, cards };
}

/**
 * Applies one review answer (SPEC §10.5): grades it against the current
 * content, reschedules the card, and writes `review_log` and a `review`
 * attempt. A third non-*again* grade in a row resolves the card's error_log
 * rows. `item_state` and the lesson % are never touched. "ignored" for an
 * unknown card, changed content, or a retry of a write already applied.
 */
export async function saveReviewWrite(db: Db, userId: string, write: ReviewWrite, now = new Date()): Promise<WriteResponse> {
  const lessonId = lessonIdOfExercise(write.exerciseId);
  const lesson = lessonId === undefined ? undefined : loadLesson(lessonId);
  if (!lesson) return { result: "ignored" };
  const [[card], [seen]] = await db.batch([
    db
      .select(storedCardColumns)
      .from(reviewCard)
      .where(and(eq(reviewCard.userId, userId), eq(reviewCard.id, write.cardId))),
    db.select({ id: reviewLog.id }).from(reviewLog).where(eq(reviewLog.id, write.eventId)),
  ]);
  if (!card || seen) return { result: "ignored" };
  const plan = planReview({ lesson, hashes: exerciseHashes(lesson), card, write, now });
  if (!plan) return { result: "ignored" };

  const writes: BatchItem<"pg">[] = [
    db
      .update(reviewCard)
      .set(plan.card)
      .where(and(eq(reviewCard.userId, userId), eq(reviewCard.id, card.id))),
    db.insert(reviewLog).values({ ...plan.log, userId }),
    db.insert(exerciseAttempt).values({ ...plan.attempt, userId }),
  ];
  if (plan.resolves) {
    writes.push(
      db
        .update(errorLog)
        .set({ resolved: true })
        .where(and(eq(errorLog.userId, userId), eq(errorLog.itemId, card.refId), eq(errorLog.resolved, false))),
    );
  }
  await db.batch(writes as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return { result: "saved" };
}

/** A lesson-wide write's reads: the lesson, its stored rows and progress. Undefined for a lesson the content doesn't have. */
async function readLessonState(db: Db, userId: string, lessonId: string) {
  const lesson = loadLesson(lessonId);
  if (!lesson) return undefined;
  const [rows, [progress]] = await db.batch([lessonRows(db, userId, lesson.id), storedProgress(db, userId, lesson.id)]);
  return { lesson, hashes: exerciseHashes(lesson), rows, progress };
}

/**
 * Correggi i miei errori (SPEC §4.4): reopens the lesson's wrong and solved
 * scorable items as stored now. "ignored" when there is nothing to reopen, so
 * a retried request changes nothing. Either way it answers with the lesson's
 * entries as now saved, so a retry after a lost response still settles the
 * client's reopened entries.
 */
export async function saveCorrection(db: Db, userId: string, write: CorrectionWrite, now = new Date()): Promise<CorrectionResponse> {
  const state = await readLessonState(db, userId, write.lessonId);
  if (!state) return { result: "ignored" };
  const before = Object.fromEntries(savedEntries(state.lesson, state.rows));
  const plan = planCorrection({ ...state, at: write.at, now });
  if (!plan) return { result: "ignored", saved: before };

  await db.batch([
    db.insert(exerciseAttempt).values(plan.attempts.map((row) => ({ ...row, userId }))),
    ...plan.itemStates.map((row) => upsertItemState(db, userId, row)),
    upsertProgress(db, userId, plan.progress),
  ]);
  const savedAt = now.toISOString();
  const reopened = Object.fromEntries([...plan.entries].map(([id, entry]) => [id, { entry, savedAt }]));
  return { result: "saved", saved: { ...before, ...reopened } };
}

/** Reaching the Finish screen completes the lesson (SPEC §4.9). */
export async function saveFinish(db: Db, userId: string, write: FinishWrite, now = new Date()): Promise<WriteResponse> {
  const state = await readLessonState(db, userId, write.lessonId);
  if (!state) return { result: "ignored" };
  await upsertProgress(db, userId, planFinish({ ...state, now }));
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

/** The lessons an Azzera covers: the one lesson, or every lesson of the level. Empty for content we don't have. */
function resetLessons(write: ResetWrite): Lesson[] {
  if (write.scope === "lesson") {
    const lesson = loadLesson(write.lessonId);
    return lesson ? [lesson] : [];
  }
  const level = loadCourse().levels.find((candidate) => candidate.id === write.levelId);
  return (level?.units ?? []).flatMap((unit) => unit.lessons.map((lessonId) => loadLesson(lessonId)!));
}

/**
 * Azzera (SPEC §4.10): deletes the lessons' exercise states, puts the lessons
 * back to not started and logs a `reset` attempt per cleared exercise. The
 * error log is kept. A retry finds nothing to clear and changes nothing more.
 */
export async function saveReset(db: Db, userId: string, write: ResetWrite, now = new Date()): Promise<ResetResponse> {
  const lessons = resetLessons(write);
  if (lessons.length === 0) return { result: "ignored" };
  const lessonIds = lessons.map((lesson) => lesson.id);
  const rows = await db
    .select({ itemId: itemState.itemId, lessonId: itemState.lessonId })
    .from(itemState)
    .where(and(eq(itemState.userId, userId), inArray(itemState.lessonId, lessonIds)));
  const plan = planReset({ lessons, rows, at: write.at });

  const writes: BatchItem<"pg">[] = [
    db.delete(itemState).where(and(eq(itemState.userId, userId), inArray(itemState.lessonId, plan.lessonIds))),
    db
      .update(lessonProgress)
      .set(plan.progress)
      .where(and(eq(lessonProgress.userId, userId), inArray(lessonProgress.lessonId, plan.lessonIds))),
  ];
  if (plan.attempts.length > 0) writes.push(db.insert(exerciseAttempt).values(plan.attempts.map((row) => ({ ...row, userId }))));
  await db.batch(writes as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return { result: "saved", resetAt: now.toISOString() };
}
