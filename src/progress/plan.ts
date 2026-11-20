/**
 * Planning a progress write (SPEC §8, §10.2–10.4): from the stored rows and one
 * learner action, the rows to write. Pure: the server action reads the rows,
 * calls this, and writes the result in one batch.
 */
import type { Lesson } from "@/content/schema";
import type { errorLog, exerciseAttempt, itemState, lessonProgress as lessonProgressTable } from "@/db/schema";
import { type ExerciseEntry, NEW_ENTRY } from "@/items/entry";
import { type ExerciseAction, applyAction, findItem, parseAnswer } from "@/items/engine";
import { type ExerciseState } from "@/scoring/exercise";
import { bestPercent, lessonProgress, lessonStatus } from "@/scoring/lesson";

/** One learner action as the client sends it. `eventId` makes a retried write harmless. */
export type ExerciseWrite = { eventId: string; lessonId: string; exerciseId: string } & ExerciseAction;

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

/** The rows one action writes, or undefined when it changes nothing or names no exercise. */
export function planExerciseWrite({
  lesson,
  hashes,
  rows,
  progress,
  action,
  now,
}: {
  lesson: Lesson;
  hashes: ReadonlyMap<string, string>;
  rows: readonly StoredItemRow[];
  progress: StoredProgress;
  action: ExerciseWrite;
  now: Date;
}): ExerciseWritePlan | undefined {
  const item = findItem(lesson, action.exerciseId);
  const contentHash = hashes.get(action.exerciseId);
  if (!item || !contentHash) return undefined;

  const entries = restoreEntries(lesson, hashes, rows);
  const before = entries.get(item.id) ?? NEW_ENTRY;
  const outcome = applyAction(item, before, action);
  if (!outcome) return undefined;
  const { entry } = outcome;
  entries.set(item.id, entry);

  const firstCheckWrong = outcome.action === "check" && before.state.firstCheckCorrect === null && outcome.correct === false;
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
      result: null,
      correct: outcome.correct,
    },
    errors: firstCheckWrong
      ? [
          {
            source: "exercise",
            lessonId: lesson.id,
            itemId: item.id,
            errorTags: item.error_tags ?? [],
            expected: outcome.expected,
            given: outcome.given,
          },
        ]
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
