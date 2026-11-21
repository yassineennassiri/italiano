/**
 * Planning a progress write (SPEC §8, §10.2–10.4): from the stored rows and one
 * learner action, the rows to write. Pure: the server action reads the rows,
 * calls this, and writes the result in one batch.
 */
import { z } from "zod";
import { parseStepLocation } from "@/content/lesson-nav";
import type { Item, Lesson } from "@/content/schema";
import type { errorLog, exerciseAttempt, itemState, lessonProgress as lessonProgressTable } from "@/db/schema";
import { type ExerciseEntry, NEW_ENTRY } from "@/items/entry";
import { applyAction, checkActionSchema, findItem, isCheckAction, parseAnswer, pickActionSchema, solveActionSchema } from "@/items/engine";
import { type ExerciseState } from "@/scoring/exercise";
import { bestPercent, lessonProgress, lessonStatus } from "@/scoring/lesson";

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
]);
export type ExerciseWrite = z.infer<typeof exerciseWriteSchema>;

/** A visit to a step page, so reopening the lesson resumes there (`last_location`). */
export const visitWriteSchema = z.strictObject({
  lessonId: z.string().min(1),
  location: z.string().refine((location) => parseStepLocation(location) !== undefined, "must look like esercizi/3"),
});
export type VisitWrite = z.infer<typeof visitWriteSchema>;

export type StoredItemRow = Pick<
  typeof itemState.$inferSelect,
  "itemId" | "status" | "firstCheckCorrect" | "points" | "answer" | "contentHash"
>;

export type StoredProgress =
  | Partial<Pick<typeof lessonProgressTable.$inferSelect, "status" | "startedAt" | "bestPercent">>
  | undefined;

type Row<T extends { $inferInsert: object }> = Omit<T["$inferInsert"], "userId">;

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
    const item = findItem(lesson, row.itemId);
    const parsed = item && parseAnswer(item, row.answer);
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
function resolveOutcome(item: Item, before: ExerciseEntry, action: ExerciseWrite, firstCheckAt: Date | null) {
  const earlierFirstCheck =
    isCheckAction(action) && before.state.firstCheckCorrect !== null && firstCheckAt !== null && new Date(action.at) < firstCheckAt;
  const outcome = applyAction(item, before, action);
  if (!earlierFirstCheck) {
    return outcome && { outcome, firstCheckWrong: outcome.action === "check" && before.state.firstCheckCorrect === null && outcome.correct === false };
  }
  const verdict = applyAction(item, NEW_ENTRY, action);
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
  const item = findItem(lesson, action.exerciseId);
  const contentHash = hashes.get(action.exerciseId);
  if (!item || !contentHash || action.contentHash !== contentHash) return undefined;

  const entries = restoreEntries(lesson, hashes, rows);
  const resolved = resolveOutcome(item, entries.get(item.id) ?? NEW_ENTRY, action, firstCheckAt);
  if (!resolved) return undefined;
  const { outcome, firstCheckWrong } = resolved;
  const { entry } = outcome;
  entries.set(item.id, entry);
  const at = new Date(action.at);
  const counts = lessonProgress(lesson, new Map([...entries].map(([id, { state }]) => [id, state])));

  return {
    entry,
    itemState: {
      itemId: item.id,
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
      itemId: item.id,
      lessonId: lesson.id,
      contentVersion: lesson.version,
      action: outcome.action,
      answer: entry.answer,
      result: outcome.result ?? null,
      correct: outcome.correct,
      createdAt: at,
    },
    errors: firstCheckWrong
      ? outcome.errors.map(({ gapId, expected, given }) => ({
          source: "exercise" as const,
          lessonId: lesson.id,
          itemId: item.id,
          ...(gapId !== undefined && { gapId }),
          errorTags: item.error_tags ?? [],
          expected,
          given,
          createdAt: at,
        }))
      : [],
    progress: {
      lessonId: lesson.id,
      contentVersion: lesson.version,
      status: progress?.status === "completed" ? "completed" : lessonStatus(counts, false),
      lastPercent: counts.percent,
      bestPercent: bestPercent(progress?.bestPercent ?? null, counts.percent),
      startedAt: progress?.startedAt ?? now,
      updatedAt: now,
    },
  };
}
