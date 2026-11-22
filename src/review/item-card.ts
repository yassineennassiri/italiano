/**
 * Item cards (SPEC §10.5): which answers open one, how a review answer is
 * graded, and what a grade does to the card. Pure: the lesson write plan and
 * the review write plan both call it.
 */
import type { reviewCard } from "@/db/schema";
import type { ExerciseEntry, ExerciseOutcome } from "@/items/entry";
import { dueAt } from "./day";
import { type Grade, sm2 } from "./sm2";

/** The stored card fields a grade reads. */
export type StoredCard = Pick<typeof reviewCard.$inferSelect, "id" | "intervalDays" | "ease" | "reps" | "lapses" | "streak">;

/** An item card as a plan writes it; the store adds the user. */
export type CardRow = Omit<typeof reviewCard.$inferInsert, "userId" | "createdAt">;

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

/** The card after a grade: its new schedule, due day, streak and last result. */
export function gradeCard(card: StoredCard, grade: Grade, now: Date): Omit<CardRow, "kind" | "refId"> {
  const { dueInDays, ...schedule } = sm2(card.id, card, grade);
  return {
    id: card.id,
    ...schedule,
    dueAt: dueAt(now, dueInDays),
    streak: grade === "again" ? 0 : card.streak + 1,
    lastResult: grade,
    updatedAt: now,
  };
}

/**
 * A lesson answer that opens a card: a new card due tomorrow, or the existing
 * one graded *again* (which is also due tomorrow).
 */
export function openedCard(existing: StoredCard | undefined, newId: string, refId: string, now: Date): CardRow {
  if (existing) return { kind: "item", refId, ...gradeCard(existing, "again", now) };
  return {
    id: newId,
    kind: "item",
    refId,
    dueAt: dueAt(now, 1),
    intervalDays: 1,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    streak: 0,
    lastResult: null,
    updatedAt: now,
  };
}
