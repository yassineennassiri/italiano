/**
 * Item cards (SPEC §10.5): which answers open one, how a review answer is
 * graded, and what a grade does to the card. Pure: the lesson write plan and
 * the review write plan both call it.
 */
import type { reviewCard, reviewLog } from "@/db/schema";
import type { ExerciseEntry, ExerciseOutcome } from "@/items/entry";
import { dueAt } from "./day";
import { type Grade, NEW_SCHEDULE, sm2 } from "./sm2";

/** The stored card fields a grade reads. */
export type StoredCard = Pick<typeof reviewCard.$inferSelect, "id" | "refId" | "intervalDays" | "ease" | "reps" | "lapses" | "streak">;

/** An item card as a plan writes it; the store adds the user. */
export type CardRow = Omit<typeof reviewCard.$inferInsert, "userId" | "createdAt">;

/** A card's new state after a grade, as a plan writes it. */
export type GradedCard = Omit<CardRow, "kind" | "refId"> & Pick<typeof reviewCard.$inferSelect, "intervalDays" | "ease" | "streak">;

/** A review_log row as a plan writes it; the store adds the user. */
export type ReviewLogRow = Omit<typeof reviewLog.$inferInsert, "userId">;

/**
 * When a grade counts from: when the learner answered, on their computer
 * (SPEC §8), so an answer synced late is scheduled from when it was given.
 * Never later than the server's now, in case that computer's clock runs fast.
 */
export const gradedAt = (at: string, now: Date): Date => new Date(Math.min(new Date(at).getTime(), now.getTime()));

/** Non-*again* grades in a row that resolve the card's error_log rows (§10.4). */
export const RESOLVE_STREAK = 3;

/** A wrong Check whose only mistakes are accents (SPEC §5.1): it never makes or resets a card. */
export function isAccentOnlyMiss(outcome: Pick<ExerciseOutcome<unknown>, "correct" | "result">): boolean {
  if (outcome.correct !== false || !outcome.result) return false;
  const verdicts = Object.values(outcome.result);
  return verdicts.includes("accent_only") && verdicts.every((verdict) => verdict !== "wrong");
}

/**
 * Whether a lesson answer creates the exercise's item card, or grades an
 * existing one *again*: a wrong first Check (not accent-only), Soluzione
 * before any Check, or *Non tanto bene* on a speaking exchange. Parla! is
 * left out, as in the backfill: it is an open task tied to the scene, not an
 * exercise to re-ask.
 */
export function opensItemCard({
  before,
  outcome,
  firstCheckWrong,
  exchange,
}: {
  before: ExerciseEntry;
  outcome: ExerciseOutcome<unknown>;
  firstCheckWrong: boolean;
  /** True for a speak_rate exchange. */
  exchange: boolean;
}): boolean {
  switch (outcome.action) {
    case "check":
      return firstCheckWrong && !isAccentOnlyMiss(outcome);
    case "solve":
      return before.state.firstCheckCorrect === null;
    case "rate":
      return exchange && outcome.entry.state.status === "rated_not_great";
  }
}

/**
 * A review answer's grade (SPEC §10.5, ADR-0004): right → *good*, accent-only
 * → *hard*, wrong or Soluzione → *again*; *Bene* / *Non tanto bene* →
 * *good* / *again*.
 */
export function reviewGrade(outcome: ExerciseOutcome<unknown>): Grade {
  switch (outcome.action) {
    case "check":
      if (outcome.correct) return "good";
      return isAccentOnlyMiss(outcome) ? "hard" : "again";
    case "solve":
      return "again";
    case "rate":
      return outcome.entry.state.status === "rated_good" ? "good" : "again";
  }
}

/**
 * A grade and what it writes: the card's new schedule, due day (from `at`),
 * streak and last result, and its `review_log` row (ADR-0004), whose id is
 * the write's eventId.
 */
export function gradeCard({
  card,
  grade,
  source,
  eventId,
  at,
  now,
}: {
  card: StoredCard;
  grade: Grade;
  source: ReviewLogRow["source"];
  eventId: string;
  /** When the grade counts from (`gradedAt`). */
  at: Date;
  now: Date;
}): { card: GradedCard; log: ReviewLogRow } {
  const { dueInDays, ...schedule } = sm2(card.id, card, grade);
  return {
    card: {
      id: card.id,
      ...schedule,
      dueAt: dueAt(at, dueInDays),
      streak: grade === "again" ? 0 : card.streak + 1,
      lastResult: grade,
      updatedAt: now,
    },
    log: {
      id: eventId,
      cardId: card.id,
      grade,
      intervalBefore: card.intervalDays,
      intervalAfter: schedule.intervalDays,
      easeBefore: card.ease,
      easeAfter: schedule.ease,
      source,
      createdAt: at,
    },
  };
}

/**
 * A lesson answer that opens a card: a new card due tomorrow, or the existing
 * one graded *again* (also due tomorrow), which is logged with source `lesson`.
 */
export function openedCard({
  existing,
  newId,
  refId,
  eventId,
  at,
  now,
}: {
  existing: StoredCard | undefined;
  newId: string;
  refId: string;
  eventId: string;
  at: Date;
  now: Date;
}): { card: CardRow; log?: ReviewLogRow } {
  if (existing) {
    const { card, log } = gradeCard({ card: existing, grade: "again", source: "lesson", eventId, at, now });
    return { card: { kind: "item", refId, ...card }, log };
  }
  return {
    card: { id: newId, kind: "item", refId, dueAt: dueAt(at, 1), ...NEW_SCHEDULE, streak: 0, lastResult: null, updatedAt: now },
  };
}
