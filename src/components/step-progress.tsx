"use client";

import { createContext, type ReactNode, use, useEffect, useSyncExternalStore } from "react";
import type { Exchange, Item } from "@/content/schema";
import { type Exercise, type ExerciseAction, exchangeExercise, itemExercise } from "@/items/engine";
import type { ExerciseEntry } from "@/items/entry";
import { entriesVersion, entryOf, progressQueue, recordStepVisit, submitAction, subscribeEntries } from "@/progress/client";
import type { SavedEntry } from "@/progress/merge";
import { type LessonShape, lessonExercises, lessonProgress } from "@/scoring/lesson";
import { ui } from "@/ui-it";

type StepProgressValue = {
  entry: (exerciseId: string) => ExerciseEntry;
  dispatch: (exercise: Exercise, action: ExerciseAction) => void;
  step: LessonShape["steps"][number];
};

const StepProgressContext = createContext<StepProgressValue | null>(null);

/**
 * The exercise entries of one step page: the server's saved entries, with this
 * tab's changes over them. Records the visit, so reopening the lesson resumes here.
 */
export function StepProgress({
  lessonId,
  location,
  saved,
  loaded,
  hashes,
  step,
  children,
}: {
  lessonId: string;
  /** `esercizi/3` */
  location: string;
  saved: Record<string, SavedEntry>;
  /** False when the database couldn't be read: the footer shows Offline. */
  loaded: boolean;
  /** Content hash of each exercise on the step, sent with every write. */
  hashes: Record<string, string>;
  step: LessonShape["steps"][number];
  children: ReactNode;
}) {
  // Re-render on every local change; the server snapshot has none.
  useSyncExternalStore(subscribeEntries, entriesVersion, () => 0);
  useEffect(() => recordStepVisit({ lessonId, location }), [lessonId, location]);
  useEffect(() => {
    if (!loaded) progressQueue.reportUnreachable();
  }, [loaded]);

  const value: StepProgressValue = {
    entry: (exerciseId) => entryOf(exerciseId, saved[exerciseId]),
    dispatch: (exercise, action) => submitAction(lessonId, exercise, saved[exercise.id], hashes[exercise.id], action),
    step,
  };
  return <StepProgressContext value={value}>{children}</StepProgressContext>;
}

function useStepProgress(): StepProgressValue {
  const value = use(StepProgressContext);
  if (!value) throw new Error("useStepProgress needs a <StepProgress> around it.");
  return value;
}

/** One exercise's entry and the function that applies an action to it: the item, or one exchange of a speak_rate item. */
export function useExercise(item: Item, exchange?: Exchange): [ExerciseEntry, (action: ExerciseAction) => void] {
  const { entry, dispatch } = useStepProgress();
  const exercise = exchange ? exchangeExercise(item, exchange) : itemExercise(item);
  return [entry(exercise.id), (action) => dispatch(exercise, action)];
}

/** The footer band's live counter (SPEC §6.2) for this step. */
export function StepCounterText() {
  const { entry, step } = useStepProgress();
  const states = new Map(lessonExercises({ steps: [step] }).map(({ id }) => [id, entry(id).state]));
  return <p aria-live="polite">{ui.lesson.footerCounter(lessonProgress({ steps: [step] }, states))}</p>;
}
