/**
 * The `single_choice` item (SPEC §5.2.4): clicking an option checks it at
 * once. Right: green, a point if it was the first Check, and the item locks.
 * Wrong: red, and the other options stay open for a retry at 0 points.
 * Solve, when the item is `solvable`, shows the answer for 0 points.
 */
import { z } from "zod";
import type { Item } from "@/content/schema";
import { applyEvent } from "@/scoring/exercise";
import type { ExerciseEntry, ExerciseOutcome } from "./entry";

/** single_choice shares its schema variant with image_choice and audio_choice (M2). */
export type SingleChoiceItem = Pick<Extract<Item, { options: string[]; answer: number }>, "id" | "options" | "answer" | "solvable">;

/** The stored answer: every option picked so far, in order. */
export const singleChoiceAnswerSchema = z.strictObject({ picks: z.array(z.number().int().nonnegative()) });
export type SingleChoiceAnswer = z.infer<typeof singleChoiceAnswerSchema>;

/** How an option button looks: open, green ✓, red ✗, or greyed out. */
export type OptionLook = "idle" | "correct" | "wrong" | "dimmed";

type Entry = ExerciseEntry<SingleChoiceAnswer>;

const picksOf = (entry: Entry): number[] => (entry.state.status === "untouched" ? [] : (entry.answer?.picks ?? []));

/** Right, or solved: every option is disabled. */
export const isLocked = (entry: Pick<ExerciseEntry, "state">) => entry.state.status === "checked_correct" || entry.state.status === "solved";

/** Picks option `index`, or undefined when the click does nothing (locked item, or an option already marked wrong). */
export function pickOption(item: SingleChoiceItem, entry: Entry, index: number): ExerciseOutcome<SingleChoiceAnswer> | undefined {
  const picks = picksOf(entry);
  if (isLocked(entry) || picks.includes(index) || index < 0 || index >= item.options.length) return undefined;
  const correct = index === item.answer;
  return {
    entry: { state: applyEvent(entry.state, { type: "check", correct }), answer: { picks: [...picks, index] } },
    action: "check",
    correct,
    expected: item.options[item.answer],
    given: item.options[index],
  };
}

/** Solves the item, or undefined when it isn't solvable or is already locked. */
export function solveSingleChoice(item: SingleChoiceItem, entry: Entry): ExerciseOutcome<SingleChoiceAnswer> | undefined {
  if (!item.solvable || isLocked(entry)) return undefined;
  return {
    entry: { state: applyEvent(entry.state, { type: "solve" }), answer: { picks: picksOf(entry) } },
    action: "solve",
    correct: null,
  };
}

/** How each option looks and whether it can be clicked. */
export function optionLooks(item: SingleChoiceItem, entry: Entry): { look: OptionLook; disabled: boolean }[] {
  const picks = picksOf(entry);
  const locked = isLocked(entry);
  return item.options.map((_, index) => {
    if (locked && index === item.answer) return { look: "correct", disabled: true };
    if (picks.includes(index) && (!locked || entry.state.status === "solved")) return { look: "wrong", disabled: true };
    return locked ? { look: "dimmed", disabled: true } : { look: "idle", disabled: false };
  });
}
