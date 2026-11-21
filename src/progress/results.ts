/**
 * What the Results and Finish screens show (SPEC §4.4, §4.9): the lesson %,
 * S/M, the score band of the encouraging line, and where *Correggi i miei
 * errori* goes. Pure: the scoring core counts, this only reads it.
 */
import { type ExerciseState, isReopenable, UNTOUCHED } from "@/scoring/exercise";
import { type LessonProgress, type LessonShape, lessonExercises, lessonProgress } from "@/scoring/lesson";

/** The band that picks the encouraging line: ≥80%, 50–79%, <50%. */
export type ScoreBand = "great" | "good" | "retry";

/** The score band of a lesson %. */
export function scoreBand(percent: number): ScoreBand {
  if (percent >= 80) return "great";
  return percent >= 50 ? "good" : "retry";
}

/**
 * Correggi i miei errori: the first step with a wrong or unattempted scorable
 * item, and the scorable items to reopen (wrong or solved, across the lesson).
 * Self-rated exercises are never part of it.
 */
export type Correction = { stepNumber: number; reopen: string[] };

export type LessonResults = LessonProgress & {
  band: ScoreBand;
  /** Undefined when every scorable item is right: there is nothing to correct. */
  correction?: Correction;
};

/** The lesson's results from its exercise states, keyed by exercise id; a missing state is untouched. */
export function lessonResults(lesson: LessonShape, states: ReadonlyMap<string, ExerciseState>): LessonResults {
  const progress = lessonProgress(lesson, states);
  return { ...progress, band: scoreBand(progress.percent), correction: correction(lesson, states) };
}

function correction(lesson: LessonShape, states: ReadonlyMap<string, ExerciseState>): Correction | undefined {
  const scorable = lessonExercises(lesson)
    .filter((exercise) => exercise.scorable)
    .map((exercise) => ({ ...exercise, state: states.get(exercise.id) ?? UNTOUCHED }));
  const toFix = scorable.filter(({ state }) => state.status === "untouched" || isReopenable(state));
  if (toFix.length === 0) return undefined;
  return {
    stepNumber: lesson.steps.findIndex((step) => step.id === toFix[0].stepId) + 1,
    reopen: toFix.filter(({ state }) => isReopenable(state)).map(({ id }) => id),
  };
}
