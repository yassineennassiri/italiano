/**
 * Lesson-level counting and percentages (SPEC §6.1, ADR-0002). Pure: no
 * React, no database.
 */
import type { ItemType } from "@/content/schema";
import { isCompleted, UNTOUCHED, type ExerciseState } from "./exercise";

/** The parts of a lesson that scoring reads. A loaded `Lesson` fits it. */
export type LessonShape = {
  steps: readonly {
    id: string;
    items: readonly (
      | { id: string; type: "speak_rate"; exchanges: readonly { id: string }[] }
      | { id: string; type: Exclude<ItemType, "speak_rate"> }
    )[];
  }[];
};

/** One unit of the footer's "X of Y" counter. */
export type Exercise = {
  /** The item id, or for a speaking exchange the item id + "." + exchange id. */
  id: string;
  stepId: string;
  /** False for self-rated exercises: they count as exercises but never in points or the %. */
  scorable: boolean;
};

/** Every exercise of a lesson, in order. */
export function lessonExercises(lesson: LessonShape): Exercise[] {
  return lesson.steps.flatMap((step) =>
    step.items.flatMap((item): Exercise[] => {
      switch (item.type) {
        case "speak_rate":
          return item.exchanges.map((exchange) => ({ id: `${item.id}.${exchange.id}`, stepId: step.id, scorable: false }));
        case "parla":
          return [{ id: item.id, stepId: step.id, scorable: false }];
        default:
          return [{ id: item.id, stepId: step.id, scorable: true }];
      }
    }),
  );
}

export type LessonProgress = {
  /** Footer: "{completed} di {total} esercizi completati. {points} punti." */
  completed: number;
  total: number;
  points: number;
  /** The % denominator: exercises that are not self-rated. */
  scorable: number;
  /** round-half-up(100 × points ÷ scorable); unattempted items count as 0. */
  percent: number;
  /** Results S/M: a step is completed when all its exercises are. */
  completedSteps: number;
  totalSteps: number;
};

/** Progress from the exercise states, keyed by exercise id; a missing state is untouched. */
export function lessonProgress(lesson: LessonShape, states: ReadonlyMap<string, ExerciseState>): LessonProgress {
  const exercises = lessonExercises(lesson).map((exercise) => ({
    ...exercise,
    state: states.get(exercise.id) ?? UNTOUCHED,
  }));
  const scored = exercises.filter((exercise) => exercise.scorable);
  const points = scored.reduce((sum, exercise) => sum + exercise.state.points, 0);
  const done = (stepId: string) =>
    exercises.every((exercise) => exercise.stepId !== stepId || isCompleted(exercise.state));
  return {
    completed: exercises.filter((exercise) => isCompleted(exercise.state)).length,
    total: exercises.length,
    points,
    scorable: scored.length,
    percent: roundedPercent(points, scored.length),
    completedSteps: lesson.steps.filter((step) => done(step.id)).length,
    totalSteps: lesson.steps.length,
  };
}

/** The parts of a level that scoring reads. A loaded `Level` fits it. */
export type LevelShape = {
  units: readonly { planned_lessons: number; lessons: readonly string[] }[];
};

/**
 * Completed lessons ÷ the level's planned lessons (rounded half up), so the %
 * tracks the whole course, including lessons not written yet.
 */
export function levelPercent(level: LevelShape, completedLessonIds: ReadonlySet<string>): number {
  const planned = level.units.reduce((sum, unit) => sum + unit.planned_lessons, 0);
  const completed = level.units.flatMap((unit) => unit.lessons).filter((id) => completedLessonIds.has(id)).length;
  return roundedPercent(completed, planned);
}

/** round-half-up(100 × part ÷ whole) in integer arithmetic, so 12.5 is never 12.4999…; 0 when whole is 0. */
function roundedPercent(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.floor((200 * part + whole) / (2 * whole));
}
