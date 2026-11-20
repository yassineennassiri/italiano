/**
 * The item engine: what a learner action does to one exercise, per item type.
 * Pure, so the client applies it optimistically and the server action applies
 * it again against the content before writing. Item types join as they are built.
 */
import { z } from "zod";
import type { Item, Lesson } from "@/content/schema";
import type { ExerciseEntry, ExerciseOutcome } from "./entry";
import { pickOption, solveSingleChoice } from "./single-choice";

/** A learner action on one exercise. */
export type ExerciseAction = { kind: "pick"; option: number } | { kind: "solve" };

const answerSchemas: Partial<Record<Item["type"], z.ZodType>> = {
  single_choice: z.strictObject({ picks: z.array(z.number().int().nonnegative()) }),
};

/** The item an exercise id names, for the item types the engine knows. */
export function findItem(lesson: Pick<Lesson, "steps">, exerciseId: string): Item | undefined {
  for (const step of lesson.steps) {
    const item = step.items.find((candidate) => candidate.id === exerciseId);
    if (item) return answerSchemas[item.type] ? item : undefined;
  }
  return undefined;
}

/** A stored answer if it fits the item, else undefined. Null (nothing done yet) always fits. */
export function parseAnswer(item: Item, raw: unknown): { answer: unknown } | undefined {
  if (raw === null || raw === undefined) return { answer: null };
  const result = answerSchemas[item.type]?.safeParse(raw);
  return result?.success ? { answer: result.data } : undefined;
}

/** The outcome of an action, or undefined when it changes nothing. */
export function applyAction(item: Item, entry: ExerciseEntry, action: ExerciseAction): ExerciseOutcome<unknown> | undefined {
  switch (item.type) {
    case "single_choice": {
      const current = entry as ExerciseEntry<{ picks: number[] }>;
      return action.kind === "pick" ? pickOption(item, current, action.option) : solveSingleChoice(item, current);
    }
    default:
      return undefined;
  }
}
