/**
 * What the app keeps for one exercise: its scoring state (SPEC §6.1) and the
 * learner's current inputs, mirroring an `item_state` row (§10.3). Pure: the
 * client runs it optimistically and the server action runs it for real.
 */
import type { GapVerdict } from "@/scoring/compare";
import { type ExerciseState, UNTOUCHED } from "@/scoring/exercise";

export type ExerciseEntry<A = unknown> = {
  state: ExerciseState;
  /** The inputs that restore the UI; null until the learner has done anything. */
  answer: A | null;
};

/** Right, or solved: inputs, Solve and Check are disabled. */
export const isLocked = (entry: Pick<ExerciseEntry, "state">) => entry.state.status === "checked_correct" || entry.state.status === "solved";

/** An exercise the learner hasn't touched. */
export const NEW_ENTRY: ExerciseEntry<never> = { state: UNTOUCHED, answer: null };

/** One Check or Solve and what it changed, as the attempt history records it. */
export type ExerciseOutcome<A> = {
  entry: ExerciseEntry<A>;
  action: "check" | "solve";
  /** Null for Solve. */
  correct: boolean | null;
  /** What was wrong, one per error_log row if this is a wrong first Check (SPEC §10.4); empty when right, and for Solve. */
  errors: ErrorDetail[];
  /** Gapped items: gap id → verdict, for `exercise_attempt.result` (SPEC §10.3). */
  result?: Record<string, GapVerdict>;
};

/**
 * One wrong part of a Check: what was right and what was given, and in which
 * gap for gapped items. `tags` replaces the item's error tags for its row (an
 * accent-only miss is `spelling.accent`).
 */
export type ErrorDetail = { gapId?: string; expected: string; given: string; tags?: readonly string[] };
