/**
 * Items with gaps (dropdown, text_gap; later word_bank, audio_gap), checked
 * together with Controlla (SPEC §5.1). All right: green, a point if it was the
 * first Check, and the item locks. Otherwise right gaps turn green and lock,
 * wrong gaps turn red and stay editable (editing one clears its red), for a
 * retry at 0 points. An accent-only miss is wrong like any other, with the hint
 * *Controlla l'accento* and logged as `spelling.accent`. Solve, when the item is
 * `solvable`, fills in every gap for 0 points.
 */
import { z } from "zod";
import type { Gap } from "@/content/schema";
import { checkGaps, compareTyped } from "@/scoring/compare";
import { applyEvent } from "@/scoring/exercise";
import { type ExerciseEntry, type ExerciseOutcome, isLocked } from "./entry";
import type { InputView } from "./input-look";

export type GappedItem = { id: string; gaps: readonly Pick<Gap, "id" | "answer" | "accept" | "case_sensitive">[]; solvable?: boolean };

/**
 * The stored answer: the value of each gap at the last Check (after Solve, the
 * answers). Empty gaps may be left out. Bounded, as it also arrives with Controlla.
 */
export const gapsAnswerSchema = z.strictObject({
  values: z.record(z.string().max(32), z.string().max(200)).refine((values) => Object.keys(values).length <= 64),
});
export type GapsAnswer = z.infer<typeof gapsAnswerSchema>;

/** Gap id → the learner's value. */
export type GapValues = Readonly<Record<string, string>>;

/** A gap's view: its look, and whether it shows *Controlla l'accento*. */
export type GapView = InputView & { accentHint?: true };

/** The error tag an accent-only miss is logged with (SPEC §10.4). */
export const ACCENT_TAG = "spelling.accent";

type Entry = ExerciseEntry<GapsAnswer>;

/** The values at the last Check or Solve; none before the first. */
const checkedOf = (entry: Entry): GapValues => (entry.state.status === "untouched" ? {} : (entry.answer?.values ?? {}));

const verdictOf = (gap: GappedItem["gaps"][number], value: string | undefined) => compareTyped(value ?? "", gap);

/**
 * Checks the gap values, or undefined when the Check does nothing (locked item,
 * a gap the item doesn't have). An empty gap is wrong. Gaps right at the last
 * Check stay locked, so their values are kept.
 */
export function checkGapValues(item: GappedItem, entry: Entry, values: GapValues): ExerciseOutcome<GapsAnswer> | undefined {
  if (isLocked(entry) || !Object.keys(values).every((gapId) => item.gaps.some((gap) => gap.id === gapId))) return undefined;
  const checked = checkedOf(entry);
  const next: Record<string, string> = {};
  for (const gap of item.gaps) {
    const value = verdictOf(gap, checked[gap.id]) === "correct" ? checked[gap.id] : values[gap.id];
    if (value !== undefined) next[gap.id] = value;
  }
  const { correct, gaps: result } = checkGaps(item.gaps, next);
  return {
    entry: { state: applyEvent(entry.state, { type: "check", correct }), answer: { values: next } },
    action: "check",
    correct,
    errors: item.gaps
      .filter((gap) => result[gap.id] !== "correct")
      .map((gap) => ({
        gapId: gap.id,
        expected: gap.answer,
        given: next[gap.id] ?? "",
        ...(result[gap.id] === "accent_only" && { tags: [ACCENT_TAG] }),
      })),
    result,
  };
}

/** Solves the item, or undefined when it isn't solvable or is already locked. */
export function solveGaps(item: GappedItem, entry: Entry): ExerciseOutcome<GapsAnswer> | undefined {
  if (!item.solvable || isLocked(entry)) return undefined;
  return {
    entry: {
      state: applyEvent(entry.state, { type: "solve" }),
      answer: { values: Object.fromEntries(item.gaps.map((gap) => [gap.id, gap.answer])) },
    },
    action: "solve",
    correct: null,
    errors: [],
  };
}

/** The learner's values: the last Check's, with the gaps changed since (`edits`) on top. */
export function currentValues(entry: Entry, edits: GapValues): GapValues {
  return { ...checkedOf(entry), ...edits };
}

/**
 * How each gap looks (gap id → view): open, green ✓ and locked, or red ✗ (with
 * the accent hint for an accent-only miss) until the learner edits it
 * (`edits`: the gaps changed since the last Check).
 */
export function gapLooks(item: GappedItem, entry: Entry, edits: GapValues): Record<string, GapView> {
  const checked = checkedOf(entry);
  const locked = isLocked(entry);
  const wrongChecked = entry.state.status === "checked_wrong";
  return Object.fromEntries(
    item.gaps.map((gap): [string, GapView] => {
      const verdict = verdictOf(gap, checked[gap.id]);
      if (locked || (wrongChecked && verdict === "correct")) return [gap.id, { look: "correct", disabled: true }];
      if (!wrongChecked || gap.id in edits) return [gap.id, { look: "idle", disabled: false }];
      return [gap.id, { look: "wrong", disabled: false, ...(verdict === "accent_only" && { accentHint: true as const }) }];
    }),
  );
}
