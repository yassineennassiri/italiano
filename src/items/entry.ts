/**
 * What the app keeps for one exercise: its scoring state (SPEC §6.1) and the
 * learner's current inputs, mirroring an `item_state` row (§10.3). Pure: the
 * client runs it optimistically and the server action runs it for real.
 */
import type { GapVerdict } from "@/scoring/compare";
import { type ExerciseState, isLockedStatus, UNTOUCHED } from "@/scoring/exercise";

export type ExerciseEntry<A = unknown> = {
  state: ExerciseState;
  /** The inputs that restore the UI; null until the learner has done anything. */
  answer: A | null;
};

/** Right, solved, or self-rated: inputs, Solve, Check and the rating are disabled. */
export const isLocked = (entry: Pick<ExerciseEntry, "state">) => isLockedStatus(entry.state.status);

/** An exercise the learner hasn't touched. */
export const NEW_ENTRY: ExerciseEntry<never> = { state: UNTOUCHED, answer: null };

/** One Check, Solve or self-rating and what it changed, as the attempt history records it. */
export type ExerciseOutcome<A> = {
  entry: ExerciseEntry<A>;
  action: "check" | "solve" | "rate";
  /** Null for Solve and self-ratings. */
  correct: boolean | null;
  /**
   * What went wrong, one error_log row each (SPEC §10.4): logged for a wrong
   * first Check, and for a self-rating (Non tanto bene, a hesitation note).
   * Empty when right, and for Solve.
   */
  errors: ErrorDetail[];
  /** Gapped items: gap id → verdict, for `exercise_attempt.result` (SPEC §10.3). */
  result?: Record<string, GapVerdict>;
};

/**
 * One error_log row's details. For a Check: what was right and what was
 * given, and in which gap for gapped items. For a self-rating: its `source`,
 * my expected reply, or the hesitation `note`. `errorTags` are added to the
 * item's own for its row (an accent-only miss adds `spelling.accent`).
 */
export type ErrorDetail = {
  /** Unset for a Check (`exercise`). */
  source?: "speak_rate" | "parla" | "parla_note";
  gapId?: string;
  expected?: string;
  given?: string;
  note?: string;
  errorTags?: readonly string[];
};
