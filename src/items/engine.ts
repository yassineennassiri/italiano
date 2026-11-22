/**
 * The item engine: what a learner action does to one exercise, per item type.
 * Pure, so the client applies it optimistically and the server action applies
 * it again against the content before writing. Each item type registers its
 * stored-answer schema and its action handlers once, in `ENGINES`.
 */
import { z } from "zod";
import { exchangeExerciseId } from "@/content/ids";
import type { Exchange, Item, Lesson } from "@/content/schema";
import { checkDropdown, type DropdownItem } from "./dropdown";
import type { ExerciseEntry, ExerciseOutcome } from "./entry";
import { checkGapValues, type GappedItem, type GapsAnswer, gapsAnswerSchema, solveGaps } from "./gaps";
import { checkMultiSelect, type MultiSelectAnswer, type MultiSelectItem, multiSelectAnswerSchema, solveMultiSelect } from "./multi-select";
import { NOTE_MAX_LENGTH, type Rating, type RatingAnswer, ratingAnswerSchema, ratingSchema, rateExchange, rateParla } from "./self-rating";
import { pickOption, type SingleChoiceAnswer, type SingleChoiceItem, singleChoiceAnswerSchema, solveSingleChoice } from "./single-choice";
import { checkWordOrder, solveWordOrder, type WordOrderAnswer, wordOrderAnswerSchema, type WordOrderItem } from "./word-order";

/** single_choice, image_choice and audio_choice: clicking an option checks it at once. */
export const pickActionSchema = z.strictObject({ kind: z.literal("pick"), option: z.number().int().nonnegative() });
/**
 * Controlla: the learner's inputs, in the shape the item type stores as its
 * answer (a selection, gap values). The item's engine validates it.
 */
export const checkActionSchema = z.strictObject({ kind: z.literal("check"), answer: z.unknown() });
export const solveActionSchema = z.strictObject({ kind: z.literal("solve") });
/** Bene / Non tanto bene on a self-rated exercise; Parla! sends its hesitation note with it. */
export const rateActionSchema = z.strictObject({ kind: z.literal("rate"), rating: ratingSchema, note: z.string().max(NOTE_MAX_LENGTH).optional() });

/** A learner action on one exercise: a Check (a pick, or Controlla), Solve, or a self-rating. */
export const exerciseActionSchema = z.discriminatedUnion("kind", [pickActionSchema, checkActionSchema, solveActionSchema, rateActionSchema]);
export type ExerciseAction = z.infer<typeof exerciseActionSchema>;

/** Whether the action is a Check, which the conflict rule orders by time (SPEC §8). */
export const isCheckAction = (action: Pick<ExerciseAction, "kind">): boolean => action.kind === "pick" || action.kind === "check";

/**
 * One exercise (CONTEXT.md): an item, or one exchange of a `speak_rate` item,
 * whose id is the item id + "." + the exchange id.
 */
export type Exercise = { id: string; item: Item; exchange?: Exchange };

/** The exercise that is the whole item (every type but speak_rate). */
export const itemExercise = (item: Item): Exercise => ({ id: item.id, item });

/** The exercise that is one exchange of a speak_rate item. */
export const exchangeExercise = (item: Item, exchange: Exchange): Exercise => ({ id: exchangeExerciseId(item.id, exchange.id), item, exchange });

type Outcome<A> = ExerciseOutcome<A> | undefined;

/** One item type's handlers; each returns undefined when the action changes nothing. */
type Engine<I, A> = {
  answerSchema: z.ZodType<A>;
  /** Clicking an option checks it at once (single_choice). */
  pick?: (item: I, entry: ExerciseEntry<A>, option: number) => Outcome<A>;
  /** Controlla with the learner's inputs. */
  check?: (item: I, entry: ExerciseEntry<A>, answer: A) => Outcome<A>;
  solve?: (item: I, entry: ExerciseEntry<A>) => Outcome<A>;
  /** Bene / Non tanto bene; `exchange` is set for a speak_rate exchange. */
  rate?: (item: I, entry: ExerciseEntry<A>, rating: Rating, note: string | undefined, exchange: Exchange | undefined) => Outcome<A>;
};

type AnyEngine = { answerSchema: z.ZodType; apply: (exercise: Exercise, entry: ExerciseEntry, action: ExerciseAction) => Outcome<unknown> };

/** Erases an engine's types for the registry; the content and the stored answer were validated on the way in. */
function eraseTypes<I, A>(engine: Engine<I, A>): AnyEngine {
  return {
    answerSchema: engine.answerSchema,
    apply: ({ item, exchange }, entry, action) => {
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
          return engine.solve?.(typedItem, typedEntry);
        case "rate":
          return engine.rate?.(typedItem, typedEntry, action.rating, action.note, exchange);
      }
    },
  };
}

/** single_choice, and image_choice and audio_choice, which differ only in layout (SPEC §5.2.6, §5.2.8). */
const SINGLE_CHOICE = eraseTypes<SingleChoiceItem, SingleChoiceAnswer>({
  answerSchema: singleChoiceAnswerSchema,
  pick: pickOption,
  solve: solveSingleChoice,
});

const ENGINES: Partial<Record<Item["type"], AnyEngine>> = {
  single_choice: SINGLE_CHOICE,
  image_choice: SINGLE_CHOICE,
  audio_choice: SINGLE_CHOICE,
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
  word_order: eraseTypes<WordOrderItem, WordOrderAnswer>({
    answerSchema: wordOrderAnswerSchema,
    check: (item, entry, answer) => checkWordOrder(item, entry, answer.placed),
    solve: solveWordOrder,
  }),
  speak_rate: eraseTypes<unknown, RatingAnswer>({
    answerSchema: ratingAnswerSchema,
    rate: (_item, entry, rating, note, exchange) => (exchange ? rateExchange(exchange, entry, rating, note) : undefined),
  }),
  parla: eraseTypes<unknown, RatingAnswer>({
    answerSchema: ratingAnswerSchema,
    rate: (_item, entry, rating, note) => rateParla(entry, rating, note),
  }),
};

/** Whether the engine handles this item type yet. */
export const hasEngine = (item: Pick<Item, "type">): boolean => ENGINES[item.type] !== undefined;

/** The exercise an id names, for the item types the engine handles. A speak_rate item is not one: its exchanges are. */
export function findExercise(lesson: Pick<Lesson, "steps">, exerciseId: string): Exercise | undefined {
  for (const step of lesson.steps) {
    for (const item of step.items) {
      if (!hasEngine(item)) continue;
      if (item.type === "speak_rate") {
        const exchange = item.exchanges.find((candidate) => exchangeExerciseId(item.id, candidate.id) === exerciseId);
        if (exchange) return exchangeExercise(item, exchange);
      } else if (item.id === exerciseId) {
        return itemExercise(item);
      }
    }
  }
  return undefined;
}

/** A stored answer if it fits the exercise, else undefined. Null (nothing done yet) always fits. */
export function parseAnswer(exercise: Exercise, raw: unknown): { answer: unknown } | undefined {
  if (raw === null || raw === undefined) return { answer: null };
  const result = ENGINES[exercise.item.type]?.answerSchema.safeParse(raw);
  return result?.success ? { answer: result.data } : undefined;
}

/** The outcome of an action, or undefined when it changes nothing. */
export function applyAction(exercise: Exercise, entry: ExerciseEntry, action: ExerciseAction): ExerciseOutcome<unknown> | undefined {
  return ENGINES[exercise.item.type]?.apply(exercise, entry, action);
}
