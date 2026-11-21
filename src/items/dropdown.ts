/**
 * The `dropdown` item (SPEC §5.2.1): inline selects in a sentence, checked
 * together with Controlla. All right: green, a point if it was the first Check,
 * and the item locks. Otherwise right gaps turn green and lock, wrong gaps turn
 * red and stay editable (changing one clears its red), for a retry at 0 points.
 * Solve, when the item is `solvable`, fills in every gap for 0 points.
 */
import { z } from "zod";
import type { Item } from "@/content/schema";
import { compareTyped } from "@/scoring/compare";
import { applyEvent } from "@/scoring/exercise";
import { type ExerciseEntry, type ExerciseOutcome, isLocked, type Mistake } from "./entry";
import type { OptionView } from "./option-look";

export type DropdownItem = Pick<Extract<Item, { type: "dropdown" }>, "id" | "gaps" | "solvable">;
type DropdownGap = DropdownItem["gaps"][number];

/** The stored answer: the value of each gap at the last Check (after Solve, the answers). Unchosen gaps are left out. */
export const dropdownAnswerSchema = z.strictObject({ values: z.record(z.string(), z.string()) });
export type DropdownAnswer = z.infer<typeof dropdownAnswerSchema>;

/** Gap id → chosen option. */
export type GapValues = Readonly<Record<string, string>>;

type Entry = ExerciseEntry<DropdownAnswer>;

/** The values at the last Check or Solve; none before the first. */
const checkedOf = (entry: Entry): GapValues => (entry.state.status === "untouched" ? {} : (entry.answer?.values ?? {}));

const isRight = (gap: DropdownGap, value: string | undefined) => value !== undefined && compareTyped(value, gap) === "correct";

/**
 * Checks the gap values, or undefined when the Check does nothing (locked item,
 * a value that isn't one of its gap's options). An unchosen gap is wrong. Gaps
 * right at the last Check stay locked, so their values are kept.
 */
export function checkDropdown(item: DropdownItem, entry: Entry, values: GapValues): ExerciseOutcome<DropdownAnswer> | undefined {
  if (isLocked(entry)) return undefined;
  const fits = Object.entries(values).every(([gapId, value]) => item.gaps.find((gap) => gap.id === gapId)?.options.includes(value));
  if (!fits) return undefined;

  const checked = checkedOf(entry);
  const next: Record<string, string> = {};
  const mistakes: Mistake[] = [];
  for (const gap of item.gaps) {
    const value = isRight(gap, checked[gap.id]) ? checked[gap.id] : values[gap.id];
    if (value !== undefined) next[gap.id] = value;
    if (!isRight(gap, value)) mistakes.push({ gapId: gap.id, expected: gap.answer, given: value ?? "" });
  }
  const correct = mistakes.length === 0;
  return {
    entry: { state: applyEvent(entry.state, { type: "check", correct }), answer: { values: next } },
    action: "check",
    correct,
    mistakes,
  };
}

/** Solves the item, or undefined when it isn't solvable or is already locked. */
export function solveDropdown(item: DropdownItem, entry: Entry): ExerciseOutcome<DropdownAnswer> | undefined {
  if (!item.solvable || isLocked(entry)) return undefined;
  return {
    entry: {
      state: applyEvent(entry.state, { type: "solve" }),
      answer: { values: Object.fromEntries(item.gaps.map((gap) => [gap.id, gap.answer])) },
    },
    action: "solve",
    correct: null,
    mistakes: [],
  };
}

/** The learner's values: the last Check's, with the gaps changed since (`edits`) on top. */
export function currentValues(entry: Entry, edits: GapValues): GapValues {
  return { ...checkedOf(entry), ...edits };
}

/** How each gap looks for the current values (gap id → view): open, green ✓ and locked, or red ✗ until changed. */
export function gapLooks(item: DropdownItem, entry: Entry, values: GapValues): Record<string, OptionView> {
  const checked = checkedOf(entry);
  const locked = isLocked(entry);
  const wrongChecked = entry.state.status === "checked_wrong";
  return Object.fromEntries(
    item.gaps.map((gap): [string, OptionView] => {
      if (locked || (wrongChecked && isRight(gap, checked[gap.id]))) return [gap.id, { look: "correct", disabled: true }];
      const unchanged = values[gap.id] === checked[gap.id];
      return [gap.id, { look: wrongChecked && unchanged ? "wrong" : "idle", disabled: false }];
    }),
  );
}
