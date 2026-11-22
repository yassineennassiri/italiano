/**
 * The review card scheduler: classic SM-2 (SPEC §10.5, ADR-0004). Pure, so
 * the rules are tested once and a later switch to FSRS replaces one function.
 */
import { seededRandom } from "@/items/shuffle";

/** How well a review went (CONTEXT.md "Grade"). */
export const grades = ["again", "hard", "good", "easy"] as const;
export type Grade = (typeof grades)[number];

/** A card's SM-2 state, as `review_card` stores it. */
export type Schedule = {
  /** The interval before fuzz; 0 for a card never reviewed. */
  intervalDays: number;
  ease: number;
  /** Non-*again* reviews since the last lapse. */
  reps: number;
  lapses: number;
};

export const NEW_SCHEDULE: Schedule = { intervalDays: 0, ease: 2.5, reps: 0, lapses: 0 };

const MIN_EASE = 1.3;
const MAX_INTERVAL = 180;
const FUZZ = 0.05;

/** Two decimals, so repeated grades don't pile up float noise (6 × 1.2 is 7.2, not 7.199…). */
const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The schedule after a grade, and in how many days the card is due again: the
 * interval with ±5 % fuzz, seeded by the card id and its reps so tests are
 * deterministic, as whole days between 1 and 180. The fuzz only moves the due
 * day; the stored interval stays exact.
 */
export function sm2(cardId: string, before: Schedule, grade: Grade): Schedule & { dueInDays: number } {
  const goodInterval = before.reps === 0 ? 1 : before.reps === 1 ? 6 : before.intervalDays * before.ease;
  const next: Schedule = (() => {
    switch (grade) {
      case "again":
        return { intervalDays: 1, ease: before.ease - 0.2, reps: 0, lapses: before.lapses + 1 };
      case "hard":
        return { ...before, intervalDays: Math.max(1, before.intervalDays * 1.2), ease: before.ease - 0.15, reps: before.reps + 1 };
      case "good":
        return { ...before, intervalDays: goodInterval, reps: before.reps + 1 };
      case "easy":
        return { ...before, intervalDays: goodInterval * 1.3, ease: before.ease + 0.15, reps: before.reps + 1 };
    }
  })();
  const intervalDays = round2(Math.min(MAX_INTERVAL, next.intervalDays));
  const ease = round2(Math.max(MIN_EASE, next.ease));
  const fuzz = grade === "again" ? 1 : 1 + (seededRandom(`${cardId}:${next.reps}`)() * 2 - 1) * FUZZ;
  const dueInDays = Math.min(MAX_INTERVAL, Math.max(1, Math.round(intervalDays * fuzz)));
  return { ...next, intervalDays, ease, dueInDays };
}
