/**
 * Planning a review write (SPEC §10.5, ADR-0004): from the card, the current
 * content and the learner's answer, the rows to write. The answer is graded
 * here, against the content, not trusted from the client. A review writes
 * the card's new schedule, a `review_log` row and an `exercise_attempt` row
 * with action `review`. It never writes `item_state` and never adds an
 * error_log row; a third non-*again* grade in a row only marks the card's
 * rows resolved.
 */
import { z } from "zod";
import type { Lesson } from "@/content/schema";
import type { exerciseAttempt } from "@/db/schema";
import { sessionSources } from "@/db/schema";
import { NEW_ENTRY } from "@/items/entry";
import { applyAction, checkActionSchema, findExercise, pickActionSchema, rateActionSchema, solveActionSchema } from "@/items/engine";
import type { Row } from "@/progress/plan";
import { type GradedCard, gradeCard, gradedAt, RESOLVE_STREAK, type ReviewLogRow, reviewGrade, type StoredCard } from "./item-card";
import { type Grade, grades } from "./sm2";

const cardFields = {
  /** Also the review_log row's id, so a retried write is applied once. */
  eventId: z.uuid(),
  cardId: z.uuid(),
  /** When the learner answered, on their computer. */
  at: z.iso.datetime(),
  source: z.enum(sessionSources),
};

const writeFields = {
  ...cardFields,
  /** The card's exercise: an item id, or an exchange id. */
  exerciseId: z.string().min(1),
  /** The content the answer was given against; a write for since-changed content is ignored. */
  contentHash: z.string().min(1),
};

/** A vocab card graded with one of the flip card's four buttons (SPEC §10.5). */
const vocabWriteSchema = z.strictObject({ kind: z.literal("grade"), grade: z.enum(grades), ...cardFields });
/** A vocab card's grade as the client sends it. */
export type VocabReviewWrite = z.infer<typeof vocabWriteSchema>;

/**
 * One review answer as the client sends it: the first answer given to an
 * item card in this session, or the grade given to a vocab card.
 */
export const reviewWriteSchema = z.discriminatedUnion("kind", [
  pickActionSchema.extend(writeFields),
  checkActionSchema.extend(writeFields),
  solveActionSchema.extend(writeFields),
  rateActionSchema.extend(writeFields),
  vocabWriteSchema,
]);
export type ReviewWrite = z.infer<typeof reviewWriteSchema>;
/** A review answer to an item card. */
export type ItemReviewWrite = Exclude<ReviewWrite, VocabReviewWrite>;

/** The rows one review answer writes, and its grade. */
export type ReviewPlan = {
  grade: Grade;
  card: GradedCard;
  log: ReviewLogRow;
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
  card: StoredCard;
  write: ItemReviewWrite;
  now: Date;
}): ReviewPlan | undefined {
  if (write.exerciseId !== card.refId || hashes.get(card.refId) !== write.contentHash) return undefined;
  const exercise = findExercise(lesson, card.refId);
  // The review starts from a fresh entry: the lesson's own state is never read or written.
  const outcome = exercise && applyAction(exercise, NEW_ENTRY, write);
  if (!outcome) return undefined;

  const grade = reviewGrade(outcome);
  const at = gradedAt(write.at, now);
  const graded = gradeCard({ card, grade, source: write.source, eventId: write.eventId, at, now });
  return {
    grade,
    ...graded,
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
    resolves: graded.card.streak >= RESOLVE_STREAK,
  };
}
