/**
 * The item engine: what a learner action does to one exercise, per item type.
 * Pure, so the client applies it optimistically and the server action applies
 * it again against the content before writing. Each item type registers its
 * stored-answer schema and its action handler once, in `ENGINES`.
 */
import { z } from "zod";
import type { Item, Lesson } from "@/content/schema";
import type { ExerciseEntry, ExerciseOutcome } from "./entry";
import { pickOption, type SingleChoiceItem, singleChoiceAnswerSchema, solveSingleChoice } from "./single-choice";

export const pickActionSchema = z.strictObject({ kind: z.literal("pick"), option: z.number().int().nonnegative() });
export const solveActionSchema = z.strictObject({ kind: z.literal("solve") });

/** A learner action on one exercise: picking an option (a Check) or Solve. */
export const exerciseActionSchema = z.discriminatedUnion("kind", [pickActionSchema, solveActionSchema]);
export type ExerciseAction = z.infer<typeof exerciseActionSchema>;

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
      return action.kind === "pick" ? pickOption(singleChoice, current, action.option) : solveSingleChoice(singleChoice, current);
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
