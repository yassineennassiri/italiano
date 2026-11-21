/**
 * Planning a progress write (SPEC §8, §10.2–10.4): from the stored rows and one
 * learner action, the rows to write. Pure: the server action reads the rows,
 * calls this, and writes the result in one batch.
 */
import { z } from "zod";
import { parseStepLocation } from "@/content/lesson-nav";
import type { Lesson } from "@/content/schema";
import type { errorLog, exerciseAttempt, itemState, lessonProgress as lessonProgressTable } from "@/db/schema";
import { type ExerciseEntry, NEW_ENTRY } from "@/items/entry";
import {
  applyAction,
  checkActionSchema,
  type Exercise,
  findExercise,
  isCheckAction,
  parseAnswer,
  pickActionSchema,
  rateActionSchema,
  solveActionSchema,
} from "@/items/engine";
import { applyEvent, type ExerciseState, isReopenable } from "@/scoring/exercise";
import { bestPercent, lessonExercises, type LessonProgress, lessonProgress, type LessonStatus, lessonStatus, lessonStatuses } from "@/scoring/lesson";

const writeFields = {
  /** Also the attempt's id, so a retried write is applied once. */
  eventId: z.uuid(),
  lessonId: z.string().min(1),
  /** An item id, or an exchange id for speaking items. */
  exerciseId: z.string().min(1),
  /** The content the action was made against; a write for since-changed content is ignored. */
  contentHash: z.string().min(1),
  /** When the learner acted, on their computer: the conflict rule orders first Checks by it (SPEC §8). */
  at: z.iso.datetime(),
};

/** One learner action as the client sends it. */
export const exerciseWriteSchema = z.discriminatedUnion("kind", [
  pickActionSchema.extend(writeFields),
  checkActionSchema.extend(writeFields),
  solveActionSchema.extend(writeFields),
  rateActionSchema.extend(writeFields),
]);
export type ExerciseWrite = z.infer<typeof exerciseWriteSchema>;

/** A visit to a step page, so reopening the lesson resumes there (`last_location`). */
export const visitWriteSchema = z.strictObject({
  lessonId: z.string().min(1),
  location: z.string().refine((location) => parseStepLocation(location) !== undefined, "must look like esercizi/3"),
});
export type VisitWrite = z.infer<typeof visitWriteSchema>;

/** Correggi i miei errori on the Results screen. */
export const correctionWriteSchema = z.strictObject({ lessonId: z.string().min(1), at: z.iso.datetime() });
export type CorrectionWrite = z.infer<typeof correctionWriteSchema>;

/** Reaching the Finish screen, which completes the lesson. */
export const finishWriteSchema = z.strictObject({ lessonId: z.string().min(1) });
export type FinishWrite = z.infer<typeof finishWriteSchema>;

export type StoredItemRow = Pick<
  typeof itemState.$inferSelect,
  "itemId" | "status" | "firstCheckCorrect" | "points" | "answer" | "contentHash"
>;

export type StoredProgress =
  | Partial<Pick<typeof lessonProgressTable.$inferSelect, "status" | "startedAt" | "completedAt" | "bestPercent">>
  | undefined;

/** A row of the table as a plan writes it; the store adds the user. */
export type Row<T extends { $inferInsert: object }> = Omit<T["$inferInsert"], "userId">;

export type ExerciseWritePlan = {
  entry: ExerciseEntry;
  itemState: Row<typeof itemState>;
  attempt: Row<typeof exerciseAttempt>;
  errors: Row<typeof errorLog>[];
  progress: Row<typeof lessonProgressTable>;
};

/** The stored entries that still fit the content: same hash, and an answer of the right shape. */
export function restoreEntries(
  lesson: Pick<Lesson, "steps">,
  hashes: ReadonlyMap<string, string>,
  rows: readonly StoredItemRow[],
): Map<string, ExerciseEntry> {
  const entries = new Map<string, ExerciseEntry>();
  for (const row of rows) {
    if (hashes.get(row.itemId) !== row.contentHash) continue;
    const exercise = findExercise(lesson, row.itemId);
    const parsed = exercise && parseAnswer(exercise, row.answer);
    if (!parsed) continue;
    const state: ExerciseState = {
      status: row.status,
      firstCheckCorrect: row.firstCheckCorrect,
      points: row.points === 1 ? 1 : 0,
    };
    entries.set(row.itemId, { state, answer: parsed.answer });
  }
  return entries;
}

/**
 * The outcome of an action under the conflict rule (SPEC §8): the earliest
 * first Check wins, the latest state wins for everything else. A Check made
 * before the stored first Check (on another computer, synced late) sets the
 * verdict while the stored state stays; otherwise the action applies as usual.
 */
function resolveOutcome(exercise: Exercise, before: ExerciseEntry, action: ExerciseWrite, firstCheckAt: Date | null) {
  const earlierFirstCheck =
    isCheckAction(action) && before.state.firstCheckCorrect !== null && firstCheckAt !== null && new Date(action.at) < firstCheckAt;
  const outcome = applyAction(exercise, before, action);
  if (!earlierFirstCheck) {
    return outcome && { outcome, firstCheckWrong: outcome.action === "check" && before.state.firstCheckCorrect === null && outcome.correct === false };
  }
  const verdict = applyAction(exercise, NEW_ENTRY, action);
  if (!verdict) return undefined;
  const latest = outcome?.entry ?? before;
  const firstCheckCorrect = verdict.correct === true;
  const points: 0 | 1 = firstCheckCorrect && latest.state.status === "checked_correct" ? 1 : 0;
  return {
    outcome: { ...verdict, entry: { state: { ...latest.state, firstCheckCorrect, points }, answer: latest.answer } },
    firstCheckWrong: !firstCheckCorrect,
  };
}

/** The rows one action writes, or undefined when it changes nothing or names no exercise. */
export function planExerciseWrite({
  lesson,
  hashes,
  rows,
  progress,
  firstCheckAt,
  action,
  now,
}: {
  lesson: Lesson;
  hashes: ReadonlyMap<string, string>;
  rows: readonly StoredItemRow[];
  progress: StoredProgress;
  /** When the exercise's stored first Check was made, or null when it has none. */
  firstCheckAt: Date | null;
  action: ExerciseWrite;
  now: Date;
}): ExerciseWritePlan | undefined {
  const exercise = findExercise(lesson, action.exerciseId);
  const contentHash = hashes.get(action.exerciseId);
  if (!exercise || !contentHash || action.contentHash !== contentHash) return undefined;
  const { id: exerciseId, item } = exercise;

  const entries = restoreEntries(lesson, hashes, rows);
  const resolved = resolveOutcome(exercise, entries.get(exerciseId) ?? NEW_ENTRY, action, firstCheckAt);
  if (!resolved) return undefined;
  const { outcome, firstCheckWrong } = resolved;
  const { entry } = outcome;
  entries.set(exerciseId, entry);
  const at = new Date(action.at);
  const counts = lessonProgress(lesson, statesOf(entries));

  return {
    entry,
    itemState: {
      itemId: exerciseId,
      lessonId: lesson.id,
      status: entry.state.status,
      firstCheckCorrect: entry.state.firstCheckCorrect,
      points: entry.state.points,
      answer: entry.answer,
      contentHash,
      updatedAt: now,
    },
    attempt: {
      id: action.eventId,
      itemId: exerciseId,
      lessonId: lesson.id,
      contentVersion: lesson.version,
      action: outcome.action,
      answer: entry.answer,
      result: outcome.result ?? null,
      correct: outcome.correct,
      createdAt: at,
    },
    // A wrong first Check logs what was wrong; a self-rating logs Non tanto bene and the hesitation note.
    errors:
      firstCheckWrong || outcome.action === "rate"
        ? outcome.errors.map(({ source, gapId, expected, given, note, errorTags }) => ({
            source: source ?? ("exercise" as const),
            lessonId: lesson.id,
            itemId: exerciseId,
            ...(gapId !== undefined && { gapId }),
            errorTags: [...new Set([...(item.error_tags ?? []), ...(errorTags ?? [])])],
            ...(expected !== undefined && { expected }),
            ...(given !== undefined && { given }),
            ...(note !== undefined && { note }),
            createdAt: at,
          }))
        : [],
    progress: progressRow(lesson, progress, counts, now),
  };
}

/** The lesson status after a change: it never moves back (only Azzera resets it). */
function laterStatus(stored: LessonStatus | undefined, next: LessonStatus): LessonStatus {
  const rank = (status: LessonStatus | undefined) => (status === undefined ? -1 : lessonStatuses.indexOf(status));
  return rank(stored) > rank(next) ? stored! : next;
}

/** The lesson_progress row after a change to its exercises; `best_percent` never drops. */
function progressRow(lesson: Lesson, progress: StoredProgress, counts: LessonProgress, now: Date): Row<typeof lessonProgressTable> {
  return {
    lessonId: lesson.id,
    contentVersion: lesson.version,
    status: laterStatus(progress?.status, lessonStatus(counts, false)),
    lastPercent: counts.percent,
    bestPercent: bestPercent(progress?.bestPercent ?? null, counts.percent),
    startedAt: progress?.startedAt ?? now,
    updatedAt: now,
  };
}

const statesOf = (entries: ReadonlyMap<string, ExerciseEntry>) => new Map([...entries].map(([id, { state }]) => [id, state]));

/** The rows Correggi i miei errori writes. */
export type CorrectionPlan = {
  /** The reopened entries by exercise id, as now saved. */
  entries: Map<string, ExerciseEntry>;
  itemStates: Row<typeof itemState>[];
  attempts: Row<typeof exerciseAttempt>[];
  progress: Row<typeof lessonProgressTable>;
};

/**
 * Correggi i miei errori (SPEC §4.4): reopens every wrong or solved scorable
 * item, emptying its inputs but keeping `first_check_correct`, so a fixed item
 * still scores 0. Speaking exchanges and Parla! are never reset; their errors
 * are already in the error log. Undefined when there is nothing to reopen.
 */
export function planCorrection({
  lesson,
  hashes,
  rows,
  progress,
  at,
  now,
}: {
  lesson: Lesson;
  hashes: ReadonlyMap<string, string>;
  rows: readonly StoredItemRow[];
  progress: StoredProgress;
  /** When the learner asked, on their computer. */
  at: string;
  now: Date;
}): CorrectionPlan | undefined {
  const entries = restoreEntries(lesson, hashes, rows);
  const reopened = new Map<string, ExerciseEntry>();
  for (const { id, scorable } of lessonExercises(lesson)) {
    const entry = entries.get(id);
    if (!scorable || !entry || !isReopenable(entry.state)) continue;
    reopened.set(id, { state: applyEvent(entry.state, { type: "reopen" }), answer: null });
  }
  if (reopened.size === 0) return undefined;
  for (const [id, entry] of reopened) entries.set(id, entry);

  const reopenedRows = [...reopened].map(([itemId, entry]) => ({ itemId, entry, contentHash: hashes.get(itemId)! }));
  return {
    entries: reopened,
    itemStates: reopenedRows.map(({ itemId, entry, contentHash }) => ({
      itemId,
      lessonId: lesson.id,
      status: entry.state.status,
      firstCheckCorrect: entry.state.firstCheckCorrect,
      points: entry.state.points,
      answer: null,
      contentHash,
      updatedAt: now,
    })),
    attempts: reopenedRows.map(({ itemId }) => ({
      itemId,
      lessonId: lesson.id,
      contentVersion: lesson.version,
      action: "reset" as const,
      answer: null,
      result: null,
      correct: null,
      createdAt: new Date(at),
    })),
    progress: progressRow(lesson, progress, lessonProgress(lesson, statesOf(entries)), now),
  };
}

/**
 * Reaching the Finish screen (SPEC §4.9): the lesson is completed, with the
 * current % as `last_percent`. `best_percent` never drops, and the first
 * completion time is kept.
 */
export function planFinish({
  lesson,
  hashes,
  rows,
  progress,
  now,
}: {
  lesson: Lesson;
  hashes: ReadonlyMap<string, string>;
  rows: readonly StoredItemRow[];
  progress: StoredProgress;
  now: Date;
}): Row<typeof lessonProgressTable> {
  const counts = lessonProgress(lesson, statesOf(restoreEntries(lesson, hashes, rows)));
  return {
    ...progressRow(lesson, progress, counts, now),
    status: "completed",
    completedAt: progress?.completedAt ?? now,
  };
}

const lessonResetTarget = z.strictObject({ scope: z.literal("lesson"), lessonId: z.string().min(1) });
const levelResetTarget = z.strictObject({ scope: z.literal("level"), levelId: z.string().min(1) });

/** What Azzera clears: one lesson (lesson menu) or every lesson of a level (level overview), SPEC §4.10. */
export type ResetTarget = z.infer<typeof lessonResetTarget> | z.infer<typeof levelResetTarget>;

/** Azzera, confirmed; `at` is when, on the learner's computer. */
export const resetWriteSchema = z.discriminatedUnion("scope", [
  lessonResetTarget.extend({ at: z.iso.datetime() }),
  levelResetTarget.extend({ at: z.iso.datetime() }),
]);
export type ResetWrite = z.infer<typeof resetWriteSchema>;

/** The rows Azzera writes. */
export type ResetPlan = {
  /** The lessons whose `item_state` rows are deleted and whose `lesson_progress` is reset. */
  lessonIds: string[];
  /** One `reset` attempt per deleted exercise: the history keeps that it was cleared. */
  attempts: Row<typeof exerciseAttempt>[];
  /** What each lesson's `lesson_progress` becomes: not started, with no %, start, completion or resume point. */
  progress: Pick<
    typeof lessonProgressTable.$inferInsert,
    "status" | "lastLocation" | "lastPercent" | "bestPercent" | "startedAt" | "completedAt" | "updatedAt"
  >;
};

/**
 * Azzera (SPEC §4.10): the lessons' exercises go back to untouched and the
 * lessons to not started. The error log is learning history and stays; so do
 * the attempts, which gain a `reset` row per cleared exercise.
 */
export function planReset({
  lessons,
  rows,
  at,
  now,
}: {
  lessons: readonly Pick<Lesson, "id" | "version">[];
  /** The stored `item_state` rows; those of other lessons are left alone. */
  rows: readonly Pick<typeof itemState.$inferSelect, "itemId" | "lessonId">[];
  /** When the learner confirmed, on their computer. */
  at: string;
  now: Date;
}): ResetPlan {
  const versions = new Map(lessons.map((lesson) => [lesson.id, lesson.version]));
  return {
    lessonIds: [...versions.keys()],
    attempts: rows
      .filter((row) => versions.has(row.lessonId))
      .map(({ itemId, lessonId }) => ({
        itemId,
        lessonId,
        contentVersion: versions.get(lessonId)!,
        action: "reset" as const,
        answer: null,
        result: null,
        correct: null,
        createdAt: new Date(at),
      })),
    progress: { status: "not_started", lastLocation: null, lastPercent: null, bestPercent: null, startedAt: null, completedAt: null, updatedAt: now },
  };
}
