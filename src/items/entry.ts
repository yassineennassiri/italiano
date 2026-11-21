/**
 * What the app keeps for one exercise: its scoring state (SPEC §6.1) and the
 * learner's current inputs, mirroring an `item_state` row (§10.3). Pure: the
 * client runs it optimistically and the server action runs it for real.
 */
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
  /** For the error log on a wrong first Check: what was right, what was given. */
  expected?: string;
  given?: string;
};
