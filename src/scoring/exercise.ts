/**
 * The state of one exercise and how learner actions change it (SPEC §5.1,
 * §6.1, ADR-0002). Mirrors the `item_state` row (§10.3). Pure: no React, no
 * database.
 */

export type ExerciseStatus =
  | "untouched"
  | "checked_correct"
  | "checked_wrong"
  | "solved"
  | "rated_good"
  | "rated_not_great";

export type ExerciseState = {
  status: ExerciseStatus;
  /** Null until the first Check. */
  firstCheckCorrect: boolean | null;
  points: 0 | 1;
};

export type ExerciseEvent =
  | { type: "check"; correct: boolean }
  | { type: "solve" }
  /** Bene / Non tanto bene on a self-rated exercise. */
  | { type: "rate"; rating: "good" | "not_great" }
  /** Correggi i miei errori (SPEC §4.4): reopens the item, keeping its spent first Check. */
  | { type: "reset" };

export const UNTOUCHED: ExerciseState = { status: "untouched", firstCheckCorrect: null, points: 0 };

/** Statuses whose inputs, Solve and Check are disabled. */
const LOCKED: readonly ExerciseStatus[] = ["checked_correct", "solved", "rated_good", "rated_not_great"];

/**
 * The next state after an event. Learner actions on a locked exercise are
 * ignored; a reset always applies (the caller picks which items to reset).
 */
export function applyEvent(state: ExerciseState, event: ExerciseEvent): ExerciseState {
  if (event.type === "reset") return { ...state, status: "untouched" };
  if (LOCKED.includes(state.status)) return state;
  switch (event.type) {
    case "check": {
      const firstCheckCorrect = state.firstCheckCorrect ?? event.correct;
      return {
        status: event.correct ? "checked_correct" : "checked_wrong",
        firstCheckCorrect,
        points: firstCheckCorrect ? 1 : 0,
      };
    }
    case "solve":
      // Solving spends the item's one chance at a point, as a wrong first Check would.
      return { status: "solved", firstCheckCorrect: state.firstCheckCorrect ?? false, points: 0 };
    case "rate":
      // Self-ratings never score (ADR-0002).
      return { status: event.rating === "good" ? "rated_good" : "rated_not_great", firstCheckCorrect: null, points: 0 };
  }
}

/** Folds a sequence of events, starting from `from` (untouched by default). */
export function applyEvents(events: readonly ExerciseEvent[], from: ExerciseState = UNTOUCHED): ExerciseState {
  return events.reduce(applyEvent, from);
}

/** Checked (right or wrong), solved or self-rated. */
export function isCompleted(state: ExerciseState): boolean {
  return state.status !== "untouched";
}
