/**
 * The `multi_select` item (SPEC §5.2.5): options toggle on and off, and
 * Controlla evaluates the selection. All right: green, a point if it was the
 * first Check, and the item locks. Otherwise right picks turn green and lock,
 * wrong picks turn red and stay editable, for a retry at 0 points. Solve, when
 * the item is `solvable`, fills in the right options for 0 points.
 */
import { z } from "zod";
import type { Item } from "@/content/schema";
import { applyEvent } from "@/scoring/exercise";
import { type ExerciseEntry, type ExerciseOutcome, isLocked } from "./entry";
import type { OptionView } from "./option-look";

export type MultiSelectItem = Pick<Extract<Item, { type: "multi_select" }>, "id" | "options" | "answers" | "solvable">;

/** The stored answer: the selection at the last Check (after Solve, the right options), in option order. */
export const multiSelectAnswerSchema = z.strictObject({ selected: z.array(z.number().int().nonnegative()) });
export type MultiSelectAnswer = z.infer<typeof multiSelectAnswerSchema>;

type Entry = ExerciseEntry<MultiSelectAnswer>;

const sorted = (indexes: Iterable<number>): number[] => [...new Set(indexes)].sort((a, b) => a - b);

/** The selection at the last Check or Solve; none before the first. */
const checkedOf = (entry: Entry): number[] => (entry.state.status === "untouched" ? [] : (entry.answer?.selected ?? []));

/** Right picks of the last Check: green and locked, so they stay selected. */
const lockedPicks = (item: MultiSelectItem, entry: Entry): number[] =>
  checkedOf(entry).filter((index) => item.answers.includes(index));

/**
 * Checks a selection, or undefined when the Check does nothing (locked item, an
 * index outside the options). Nothing selected is a wrong Check, as Controlla
 * is enabled while untouched (SPEC §5.1).
 */
export function checkMultiSelect(item: MultiSelectItem, entry: Entry, selection: readonly number[]): ExerciseOutcome<MultiSelectAnswer> | undefined {
  if (isLocked(entry)) return undefined;
  if (selection.some((index) => !Number.isInteger(index) || index < 0 || index >= item.options.length)) return undefined;
  const selected = sorted([...lockedPicks(item, entry), ...selection]);
  const answers = sorted(item.answers);
  const correct = selected.length === answers.length && selected.every((index, i) => index === answers[i]);
  return {
    entry: { state: applyEvent(entry.state, { type: "check", correct }), answer: { selected } },
    action: "check",
    correct,
    mistakes: correct
      ? []
      : [{ expected: answers.map((index) => item.options[index]).join(", "), given: selected.map((index) => item.options[index]).join(", ") }],
  };
}

/** Solves the item, or undefined when it isn't solvable or is already locked. */
export function solveMultiSelect(item: MultiSelectItem, entry: Entry): ExerciseOutcome<MultiSelectAnswer> | undefined {
  if (!item.solvable || isLocked(entry)) return undefined;
  return {
    entry: { state: applyEvent(entry.state, { type: "solve" }), answer: { selected: sorted(item.answers) } },
    action: "solve",
    correct: null,
    mistakes: [],
  };
}

/** The learner's selection: the last Check's, with each option in `toggled` (clicked since) flipped. */
export function currentSelection(entry: Entry, toggled: readonly number[]): number[] {
  const selection = new Set(checkedOf(entry));
  for (const index of toggled) {
    if (selection.has(index)) selection.delete(index);
    else selection.add(index);
  }
  return sorted(selection);
}

/** How each option looks for the current selection, and whether it can be clicked. */
export function optionLooks(item: MultiSelectItem, entry: Entry, selection: readonly number[]): OptionView[] {
  const checked = checkedOf(entry);
  const locked = isLocked(entry);
  return item.options.map((_, index) => {
    const right = item.answers.includes(index);
    if (locked) return { look: right ? "correct" : "dimmed", disabled: true };
    if (checked.includes(index) && right) return { look: "correct", disabled: true };
    if (!selection.includes(index)) return { look: "idle", disabled: false };
    return { look: checked.includes(index) ? "wrong" : "selected", disabled: false };
  });
}
