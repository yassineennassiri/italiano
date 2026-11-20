"use client";

import { createContext, type ReactNode, use, useCallback, useEffect, useSyncExternalStore } from "react";
import type { Item } from "@/content/schema";
import type { ExerciseAction } from "@/items/engine";
import { type ExerciseEntry, NEW_ENTRY } from "@/items/entry";
import { act, entriesVersion, localEntry, recordStepVisit, subscribeEntries } from "@/progress/client";
import { type LessonShape, lessonExercises, lessonProgress } from "@/scoring/lesson";
import { ui } from "@/ui-it";

type StepProgressValue = {
  entryOf: (exerciseId: string) => ExerciseEntry;
  dispatch: (item: Item, action: ExerciseAction) => void;
  step: LessonShape["steps"][number];
};

const StepProgressContext = createContext<StepProgressValue | null>(null);

/**
 * The exercise entries of one step page: this tab's changes over the server's
 * stored state. Records the visit, so reopening the lesson resumes here.
 */
export function StepProgress({
  lessonId,
  location,
  initial,
  step,
  children,
}: {
  lessonId: string;
  /** `esercizi/3` */
  location: string;
  initial: Record<string, ExerciseEntry>;
  step: LessonShape["steps"][number];
  children: ReactNode;
}) {
  // Re-render on every local change; the server snapshot has none.
  useSyncExternalStore(subscribeEntries, entriesVersion, () => 0);
  useEffect(() => recordStepVisit({ lessonId, location }), [lessonId, location]);

  const entryOf = (exerciseId: string) => localEntry(exerciseId) ?? initial[exerciseId] ?? NEW_ENTRY;
  const dispatch = useCallback(
    (item: Item, action: ExerciseAction) => act(lessonId, item, localEntry(item.id) ?? initial[item.id] ?? NEW_ENTRY, action),
    [lessonId, initial],
  );
  return <StepProgressContext value={{ entryOf, dispatch, step }}>{children}</StepProgressContext>;
}

function useStepProgress(): StepProgressValue {
  const value = use(StepProgressContext);
  if (!value) throw new Error("useStepProgress needs a <StepProgress> around it.");
  return value;
}

/** One exercise's entry and the function that applies an action to it. */
export function useExercise(item: Item): [ExerciseEntry, (action: ExerciseAction) => void] {
  const { entryOf, dispatch } = useStepProgress();
  return [entryOf(item.id), (action) => dispatch(item, action)];
}

/** The footer band's live counter (SPEC §6.2) for this step. */
export function StepCounterText() {
  const { entryOf, step } = useStepProgress();
  const ids = lessonExercises({ steps: [step] }).map((exercise) => exercise.id);
  const counts = lessonProgress({ steps: [step] }, new Map(ids.map((id) => [id, entryOf(id).state])));
  return <p aria-live="polite">{ui.lesson.footerCounter(counts)}</p>;
}
