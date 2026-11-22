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
import { MAX_TEXT } from "./error-card";
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

/** What a drill answer carries besides the action: no card, since most drilled exercises have none. */
const drillFields = {
  /** Also the attempt's id (and with a card the review_log row's), so a retried write is applied once. */
  eventId: z.uuid(),
  /** When the learner answered, on their computer. */
  at: z.iso.datetime(),
  /** The drilled exercise: an item id, or an exchange id. */
  exerciseId: z.string().min(1),
  /** The content the answer was given against; a write for since-changed content is ignored. */
  contentHash: z.string().min(1),
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
 * An error card's typed correction (SPEC §10.5): the sentence the learner
 * typed, or null for Soluzione. The first Check or Soluzione grades the card.
 */
const errorWriteSchema = z.strictObject({ kind: z.literal("rewrite"), text: z.string().max(MAX_TEXT).nullable(), ...cardFields });
/** An error card's answer as the client sends it. */
export type ErrorReviewWrite = z.infer<typeof errorWriteSchema>;

/**
 * One review answer as the client sends it: the first answer given to an
 * item card or an error card in this session, or the grade given to a vocab card.
 */
export const reviewWriteSchema = z.discriminatedUnion("kind", [
  pickActionSchema.extend(writeFields),
  checkActionSchema.extend(writeFields),
  solveActionSchema.extend(writeFields),
  rateActionSchema.extend(writeFields),
  vocabWriteSchema,
  errorWriteSchema,
]);
export type ReviewWrite = z.infer<typeof reviewWriteSchema>;
/** A review answer to an item card. */
export type ItemReviewWrite = Exclude<ReviewWrite, VocabReviewWrite | ErrorReviewWrite>;

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
  if (write.exerciseId !== card.refId) return undefined;
  const answered = gradeAnswer(lesson, hashes, write, now);
  if (!answered) return undefined;
  const graded = gradeCard({ card, grade: answered.grade, source: write.source, eventId: write.eventId, at: answered.at, now });
  return { grade: answered.grade, ...graded, attempt: answered.attempt, resolves: graded.card.streak >= RESOLVE_STREAK };
}

/**
 * One answer in a tag drill (SPEC §10.5): the client names the exercise, not
 * a card, since most drilled exercises have none; the source is always `drill`.
 */
export const drillWriteSchema = z.discriminatedUnion("kind", [
  pickActionSchema.extend(drillFields),
  checkActionSchema.extend(drillFields),
  solveActionSchema.extend(drillFields),
  rateActionSchema.extend(drillFields),
]);
export type DrillWrite = z.infer<typeof drillWriteSchema>;

/**
 * The rows one drill answer writes. Graded like a review; with an item card,
 * the card is rescheduled and logged as in a review (`card`, `log`,
 * `resolves`); without one, no card is made and only the attempt is written.
 */
export type DrillPlan = Pick<ReviewPlan, "grade" | "attempt" | "resolves"> & Partial<Pick<ReviewPlan, "card" | "log">>;

/** The rows one drill answer writes, or undefined when it is for changed content, does nothing, or `card` is another exercise's. */
export function planDrill({
  lesson,
  hashes,
  card,
  write,
  now,
}: {
  lesson: Lesson;
  hashes: ReadonlyMap<string, string>;
  /** The exercise's item card, if it has one. */
  card: StoredCard | undefined;
  write: DrillWrite;
  now: Date;
}): DrillPlan | undefined {
  if (card && card.refId !== write.exerciseId) return undefined;
  const answered = gradeAnswer(lesson, hashes, write, now);
  if (!answered) return undefined;
  const { grade, at } = answered;
  // The attempt's id is the eventId, as for a lesson answer, so a retry without a card is still applied once.
  const attempt = { ...answered.attempt, id: write.eventId };
  if (!card) return { grade, attempt, resolves: false };
  const graded = gradeCard({ card, grade, source: "drill", eventId: write.eventId, at, now });
  return { grade, ...graded, attempt, resolves: graded.card.streak >= RESOLVE_STREAK };
}

/**
 * An answer graded against the exercise's current content, from a fresh
 * entry: the lesson's own state is never read or written. Undefined when the
 * content changed since the answer, or the answer does nothing.
 */
function gradeAnswer(
  lesson: Lesson,
  hashes: ReadonlyMap<string, string>,
  write: DrillWrite | ItemReviewWrite,
  now: Date,
): { grade: Grade; attempt: Row<typeof exerciseAttempt>; at: Date } | undefined {
  if (hashes.get(write.exerciseId) !== write.contentHash) return undefined;
  const exercise = findExercise(lesson, write.exerciseId);
  const outcome = exercise && applyAction(exercise, NEW_ENTRY, write);
  if (!outcome) return undefined;
  const at = gradedAt(write.at, now);
  return {
    grade: reviewGrade(outcome),
    at,
    attempt: {
      itemId: write.exerciseId,
      lessonId: lesson.id,
      contentVersion: lesson.version,
      action: "review",
      answer: outcome.entry.answer,
      result: outcome.result ?? null,
      correct: outcome.correct,
      createdAt: at,
    },
  };
}
