/**
 * Planning a review write (SPEC §10.5, ADR-0004): from the card, the current
 * content and the learner's answer, the rows to write. The answer is graded
 * here, against the content, not trusted from the client. A review never
 * writes `item_state` or the error log: the card's new schedule, a
 * `review_log` row and an `exercise_attempt` row with action `review`.
 */
import { z } from "zod";
import type { Lesson } from "@/content/schema";
import type { exerciseAttempt, reviewLog } from "@/db/schema";
import { reviewSources } from "@/db/schema";
import { NEW_ENTRY } from "@/items/entry";
import { applyAction, checkActionSchema, findExercise, pickActionSchema, rateActionSchema, solveActionSchema } from "@/items/engine";
import { type CardRow, gradeCard, RESOLVE_STREAK, reviewGrade, type StoredCard } from "./item-card";
import type { Grade } from "./sm2";

const writeFields = {
  /** Also the review_log row's id, so a retried write is applied once. */
  eventId: z.uuid(),
  cardId: z.uuid(),
  /** The card's exercise: an item id, or an exchange id. */
  exerciseId: z.string().min(1),
  /** The content the answer was given against; a write for since-changed content is ignored. */
  contentHash: z.string().min(1),
  /** When the learner answered, on their computer. */
  at: z.iso.datetime(),
  source: z.enum(reviewSources),
};

/** One review answer as the client sends it: the first answer given to the card in this session. */
export const reviewWriteSchema = z.discriminatedUnion("kind", [
  pickActionSchema.extend(writeFields),
  checkActionSchema.extend(writeFields),
  solveActionSchema.extend(writeFields),
  rateActionSchema.extend(writeFields),
]);
export type ReviewWrite = z.infer<typeof reviewWriteSchema>;

type Row<T extends { $inferInsert: object }> = Omit<T["$inferInsert"], "userId">;

export type ReviewPlan = {
  grade: Grade;
  card: Omit<CardRow, "kind" | "refId">;
  log: Row<typeof reviewLog>;
  attempt: Row<typeof exerciseAttempt>;
  /** The grade completes a streak of 3: the card's unresolved error_log rows become resolved (§10.4). */
  resolves: boolean;
};

/** The rows one review answer writes, or undefined when it names another exercise, is for changed content, or does nothing. */
export function planReview({
  lesson,
  hashes,
  card,
  write,
  now,
}: {
  lesson: Lesson;
  hashes: ReadonlyMap<string, string>;
  card: StoredCard & { refId: string };
  write: ReviewWrite;
  now: Date;
}): ReviewPlan | undefined {
  if (write.exerciseId !== card.refId || hashes.get(card.refId) !== write.contentHash) return undefined;
  const exercise = findExercise(lesson, card.refId);
  // The review starts from a fresh entry: the lesson's own state is never read or written.
  const outcome = exercise && applyAction(exercise, NEW_ENTRY, write);
  if (!outcome) return undefined;

  const grade = reviewGrade(outcome);
  const graded = gradeCard(card, grade, now);
  const at = new Date(write.at);
  return {
    grade,
    card: graded,
    log: {
      id: write.eventId,
      cardId: card.id,
      grade,
      intervalBefore: card.intervalDays,
      intervalAfter: graded.intervalDays!,
      easeBefore: card.ease,
      easeAfter: graded.ease!,
      source: write.source,
      createdAt: at,
    },
    attempt: {
      itemId: card.refId,
      lessonId: lesson.id,
      contentVersion: lesson.version,
      action: "review",
      answer: outcome.entry.answer,
      result: outcome.result ?? null,
      correct: outcome.correct,
      createdAt: at,
    },
    resolves: graded.streak! >= RESOLVE_STREAK,
  };
}
