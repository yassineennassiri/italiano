/**
 * The state of one exercise and how learner actions change it (SPEC §5.1,
 * §6.1, ADR-0002). Mirrors the `item_state` row (§10.3). Pure: no React, no
 * database.
 */

export const exerciseStatuses = [
  "untouched",
  "checked_correct",
  "checked_wrong",
  "solved",
  "rated_good",
  "rated_not_great",
] as const;

export type ExerciseStatus = (typeof exerciseStatuses)[number];

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
  /**
   * Correggi i miei errori (SPEC §4.4): reopens a wrong or solved item, keeping
   * its spent first Check. Not Azzera, which deletes the state instead.
   */
  | { type: "reopen" };

export const UNTOUCHED: ExerciseState = { status: "untouched", firstCheckCorrect: null, points: 0 };

/** Statuses whose inputs, Solve, Check and rating are disabled. */
const LOCKED: readonly ExerciseStatus[] = ["checked_correct", "solved", "rated_good", "rated_not_great"];

/** Right, solved, or self-rated: the exercise takes no more actions (but Correggi i miei errori can reopen some). */
export const isLockedStatus = (status: ExerciseStatus): boolean => LOCKED.includes(status);

/** Statuses that Correggi i miei errori can reopen. */
const REOPENABLE: readonly ExerciseStatus[] = ["checked_wrong", "solved"];

/** The next state after an event. Events that don't apply to the current status are ignored. */
export function applyEvent(state: ExerciseState, event: ExerciseEvent): ExerciseState {
  if (event.type === "reopen") return REOPENABLE.includes(state.status) ? { ...state, status: "untouched" } : state;
  if (isLockedStatus(state.status)) return state;
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
