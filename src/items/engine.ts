/**
 * The item engine: what a learner action does to one exercise, per item type.
 * Pure, so the client applies it optimistically and the server action applies
 * it again against the content before writing. Each item type registers its
 * stored-answer schema and its action handler once, in `ENGINES`.
 */
import { z } from "zod";
import type { Item, Lesson } from "@/content/schema";
import type { ExerciseEntry, ExerciseOutcome } from "./entry";
import { checkMultiSelect, type MultiSelectItem, multiSelectAnswerSchema, solveMultiSelect } from "./multi-select";
import { pickOption, type SingleChoiceItem, singleChoiceAnswerSchema, solveSingleChoice } from "./single-choice";

/** single_choice: clicking an option checks it at once. */
export const pickActionSchema = z.strictObject({ kind: z.literal("pick"), option: z.number().int().nonnegative() });
/** Controlla on an item with a selection (multi_select). */
export const checkActionSchema = z.strictObject({ kind: z.literal("check"), selected: z.array(z.number().int().nonnegative()).max(64) });
export const solveActionSchema = z.strictObject({ kind: z.literal("solve") });

/** A learner action on one exercise: a Check (a pick, or Controlla on a selection) or Solve. */
export const exerciseActionSchema = z.discriminatedUnion("kind", [pickActionSchema, checkActionSchema, solveActionSchema]);
export type ExerciseAction = z.infer<typeof exerciseActionSchema>;

/** Whether the action is a Check, which the conflict rule orders by time (SPEC §8). */
export const isCheckAction = (action: Pick<ExerciseAction, "kind">): boolean => action.kind !== "solve";

type Engine = {
  answerSchema: z.ZodType;
  apply: (item: Item, entry: ExerciseEntry, action: ExerciseAction) => ExerciseOutcome<unknown> | undefined;
};

const ENGINES: Partial<Record<Item["type"], Engine>> = {
  single_choice: {
    answerSchema: singleChoiceAnswerSchema,
    apply: (item, entry, action) => {
      const singleChoice = item as SingleChoiceItem;
      const current = entry as ExerciseEntry<z.infer<typeof singleChoiceAnswerSchema>>;
      if (action.kind === "pick") return pickOption(singleChoice, current, action.option);
      return action.kind === "solve" ? solveSingleChoice(singleChoice, current) : undefined;
    },
  },
  multi_select: {
    answerSchema: multiSelectAnswerSchema,
    apply: (item, entry, action) => {
      const multiSelect = item as MultiSelectItem;
      const current = entry as ExerciseEntry<z.infer<typeof multiSelectAnswerSchema>>;
      if (action.kind === "check") return checkMultiSelect(multiSelect, current, action.selected);
      return action.kind === "solve" ? solveMultiSelect(multiSelect, current) : undefined;
    },
  },
};

/** Whether the engine handles this item type yet. */
export const hasEngine = (item: Pick<Item, "type">): boolean => ENGINES[item.type] !== undefined;

/** The item an exercise id names, for the item types the engine handles. */
export function findItem(lesson: Pick<Lesson, "steps">, exerciseId: string): Item | undefined {
  for (const step of lesson.steps) {
    const item = step.items.find((candidate) => candidate.id === exerciseId);
    if (item) return hasEngine(item) ? item : undefined;
  }
  return undefined;
}

/** A stored answer if it fits the item, else undefined. Null (nothing done yet) always fits. */
export function parseAnswer(item: Item, raw: unknown): { answer: unknown } | undefined {
  if (raw === null || raw === undefined) return { answer: null };
  const result = ENGINES[item.type]?.answerSchema.safeParse(raw);
  return result?.success ? { answer: result.data } : undefined;
}

/** The outcome of an action, or undefined when it changes nothing. */
export function applyAction(item: Item, entry: ExerciseEntry, action: ExerciseAction): ExerciseOutcome<unknown> | undefined {
  return ENGINES[item.type]?.apply(item, entry, action);
}
