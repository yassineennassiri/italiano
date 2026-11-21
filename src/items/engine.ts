/**
 * The item engine: what a learner action does to one exercise, per item type.
 * Pure, so the client applies it optimistically and the server action applies
 * it again against the content before writing. Each item type registers its
 * stored-answer schema and its action handler once, in `ENGINES`.
 */
import { z } from "zod";
import type { Item, Lesson } from "@/content/schema";
import { checkDropdown, type DropdownItem } from "./dropdown";
import type { ExerciseEntry, ExerciseOutcome } from "./entry";
import { checkGapValues, type GappedItem, type GapsAnswer, gapsAnswerSchema, solveGaps } from "./gaps";
import { checkMultiSelect, type MultiSelectAnswer, type MultiSelectItem, multiSelectAnswerSchema, solveMultiSelect } from "./multi-select";
import { pickOption, type SingleChoiceAnswer, type SingleChoiceItem, singleChoiceAnswerSchema, solveSingleChoice } from "./single-choice";

/** single_choice: clicking an option checks it at once. */
export const pickActionSchema = z.strictObject({ kind: z.literal("pick"), option: z.number().int().nonnegative() });
/**
 * Controlla: the learner's inputs, in the shape the item type stores as its
 * answer (a selection, gap values). The item's engine validates it.
 */
export const checkActionSchema = z.strictObject({ kind: z.literal("check"), answer: z.unknown() });
export const solveActionSchema = z.strictObject({ kind: z.literal("solve") });

/** A learner action on one exercise: a Check (a pick, or Controlla) or Solve. */
export const exerciseActionSchema = z.discriminatedUnion("kind", [pickActionSchema, checkActionSchema, solveActionSchema]);
export type ExerciseAction = z.infer<typeof exerciseActionSchema>;

/** Whether the action is a Check, which the conflict rule orders by time (SPEC §8). */
export const isCheckAction = (action: Pick<ExerciseAction, "kind">): boolean => action.kind !== "solve";

type Outcome<A> = ExerciseOutcome<A> | undefined;

/** One item type's handlers; each returns undefined when the action changes nothing. */
type Engine<I, A> = {
  answerSchema: z.ZodType<A>;
  /** Clicking an option checks it at once (single_choice). */
  pick?: (item: I, entry: ExerciseEntry<A>, option: number) => Outcome<A>;
  /** Controlla with the learner's inputs. */
  check?: (item: I, entry: ExerciseEntry<A>, answer: A) => Outcome<A>;
  solve: (item: I, entry: ExerciseEntry<A>) => Outcome<A>;
};

type AnyEngine = { answerSchema: z.ZodType; apply: (item: Item, entry: ExerciseEntry, action: ExerciseAction) => Outcome<unknown> };

/** Erases an engine's types for the registry; the content and the stored answer were validated on the way in. */
function eraseTypes<I, A>(engine: Engine<I, A>): AnyEngine {
  return {
    answerSchema: engine.answerSchema,
    apply: (item, entry, action) => {
      const typedItem = item as I;
      const typedEntry = entry as ExerciseEntry<A>;
      switch (action.kind) {
        case "pick":
          return engine.pick?.(typedItem, typedEntry, action.option);
        case "check": {
          const answer = engine.answerSchema.safeParse(action.answer);
          return answer.success ? engine.check?.(typedItem, typedEntry, answer.data) : undefined;
        }
        case "solve":
          return engine.solve(typedItem, typedEntry);
      }
    },
  };
}

const ENGINES: Partial<Record<Item["type"], AnyEngine>> = {
  single_choice: eraseTypes<SingleChoiceItem, SingleChoiceAnswer>({
    answerSchema: singleChoiceAnswerSchema,
    pick: pickOption,
    solve: solveSingleChoice,
  }),
  multi_select: eraseTypes<MultiSelectItem, MultiSelectAnswer>({
    answerSchema: multiSelectAnswerSchema,
    check: (item, entry, answer) => checkMultiSelect(item, entry, answer.selected),
    solve: solveMultiSelect,
  }),
  dropdown: eraseTypes<DropdownItem, GapsAnswer>({
    answerSchema: gapsAnswerSchema,
    check: (item, entry, answer) => checkDropdown(item, entry, answer.values),
    solve: solveGaps,
  }),
  text_gap: eraseTypes<GappedItem, GapsAnswer>({
    answerSchema: gapsAnswerSchema,
    check: (item, entry, answer) => checkGapValues(item, entry, answer.values, { typed: true }),
    solve: solveGaps,
  }),
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
