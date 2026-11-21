/**
 * The `dropdown` item (SPEC §5.2.1): inline selects in a sentence. It behaves
 * like every gapped item (`gaps.ts`); a value must be one of its gap's options.
 */
import type { Item } from "@/content/schema";
import type { ExerciseEntry, ExerciseOutcome } from "./entry";
import { checkGapValues, type GapsAnswer, type GapValues } from "./gaps";

export type DropdownItem = Pick<Extract<Item, { type: "dropdown" }>, "id" | "gaps" | "solvable">;

/** Checks the chosen options, or undefined when the Check does nothing (see `checkGapValues`, or a value that isn't an option). */
export function checkDropdown(item: DropdownItem, entry: ExerciseEntry<GapsAnswer>, values: GapValues): ExerciseOutcome<GapsAnswer> | undefined {
  const fits = Object.entries(values).every(([gapId, value]) => item.gaps.find((gap) => gap.id === gapId)?.options.includes(value));
  return fits ? checkGapValues(item, entry, values, { typed: false }) : undefined;
}
