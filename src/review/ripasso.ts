/**
 * The Ripasso personale step (SPEC §10.5, ADR-0005): up to 3 due item cards
 * from other lessons, inserted before *Parla!*. Chosen once per lesson visit
 * and stored in `lesson_progress.review_items`; its exercises count in the
 * footer but never score. Pure apart from the lesson loader it is given.
 */
import { lessonIdOfExercise } from "@/content/ids";
import type { Item, Lesson } from "@/content/schema";
import { findExercise } from "@/items/engine";
import type { ExerciseEntry } from "@/items/entry";
import { ratingAnswerSchema } from "@/items/self-rating";
import { type ExerciseState, isCompleted } from "@/scoring/exercise";
import type { CardKind } from "./kinds";

/** The step holds at most this many exercises. */
export const RIPASSO_SIZE = 3;

/** `settings.inject_review` (SPEC §10.1): the step is on unless it is turned off. */
export const injectsReview = (settings: Readonly<Record<string, unknown>> | undefined): boolean => settings?.inject_review !== false;

/**
 * How far an answer's time may sit before the choice and still count as
 * given in this visit: answers are timed on the learner's computer, the
 * choice on the server. A card answered in an earlier visit is due again at
 * the earliest the next midnight, so its answer is hours older.
 */
export const CLOCK_SKEW_MS = 10 * 60_000;

/**
 * The exercise ids of the step: up to 3 due item cards from other lessons
 * whose exercise the content still has. Those whose item shares an error tag
 * with the lesson (the union of its items' tags) come first, then any other
 * due item cards; each group keeps `due`'s order, most overdue first.
 */
export function chooseReviewItems({
  lesson,
  due,
  load,
}: {
  lesson: Pick<Lesson, "id" | "steps">;
  /** The due cards, most overdue first. */
  due: readonly { kind: CardKind; refId: string }[];
  load: (lessonId: string) => Lesson | undefined;
}): string[] {
  const lessonTags = new Set(lesson.steps.flatMap((step) => step.items.flatMap((item) => item.error_tags ?? [])));
  const matching: string[] = [];
  const others: string[] = [];
  for (const { kind, refId } of due) {
    const lessonId = kind === "item" ? lessonIdOfExercise(refId) : undefined;
    const source = lessonId === undefined || lessonId === lesson.id ? undefined : load(lessonId);
    const exercise = source && findExercise(source, refId);
    if (!exercise) continue;
    const overlaps = (exercise.item.error_tags ?? []).some((tag) => lessonTags.has(tag));
    (overlaps ? matching : others).push(refId);
  }
  return [...matching, ...others].slice(0, RIPASSO_SIZE);
}

/**
 * An exercise of the step as answered earlier in this visit, from its
 * `review` attempt: the first answer graded the card, so the exercise shows
 * it again after a reload rather than asking (and grading) a second time.
 * It never holds a point (ADR-0005).
 */
export function ripassoEntry(
  item: Pick<Item, "type">,
  attempt: { answer: unknown; correct: boolean | null },
): ExerciseEntry {
  const { answer, correct } = attempt;
  if (item.type === "speak_rate" || item.type === "parla") {
    const rating = ratingAnswerSchema.safeParse(answer);
    const status = rating.success && rating.data.rating === "good" ? "rated_good" : "rated_not_great";
    return { state: { status, firstCheckCorrect: null, points: 0 }, answer };
  }
  if (correct === null) return { state: { status: "solved", firstCheckCorrect: false, points: 0 }, answer };
  return { state: { status: correct ? "checked_correct" : "checked_wrong", firstCheckCorrect: correct, points: 0 }, answer };
}

/** The step's footer (SPEC §6.2): its exercises count in *X di Y*, but it never shows a point. */
export function ripassoCounts(states: readonly ExerciseState[]): { completed: number; total: number; points: 0 } {
  return { completed: states.filter(isCompleted).length, total: states.length, points: 0 };
}
