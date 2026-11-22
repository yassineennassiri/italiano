"use client";

import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { applyAction, type Exercise, type ExerciseAction } from "@/items/engine";
import { type ExerciseEntry, NEW_ENTRY } from "@/items/entry";
import { progressQueue, recordStepVisit, submitReview } from "@/progress/client";
import { ripassoCounts } from "@/review/ripasso";
import { ui } from "@/ui-it";
import { ExerciseProgress } from "./step-progress";

/** One exercise of the step, and what its review write sends. */
export type RipassoExercise = {
  exerciseId: string;
  cardId: string;
  contentHash: string;
  /** The first answer given in this visit before this page load: it already graded the card. */
  restored?: ExerciseEntry;
};

/**
 * This tab's answers, by visit and exercise, so going on to Parla! and back
 * shows them before the server has them.
 */
const answered = new Map<string, ExerciseEntry>();

const CountsContext = createContext<{ completed: number; total: number; points: number } | null>(null);

/**
 * The Ripasso personale step (SPEC §10.5, ADR-0005): its items behave as in a
 * lesson, but they never score, and the first answer to each grades its
 * item card with source `ripasso_personale`. Nothing is written to the
 * lesson's own progress, apart from the visit, so reopening the lesson resumes here.
 */
export function RipassoProgress({
  lessonId,
  location,
  visit,
  exercises,
  loaded,
  children,
}: {
  lessonId: string;
  /** `esercizi/6` */
  location: string;
  /** When the step was chosen, which tells this visit's answers from an earlier one's. */
  visit: string;
  exercises: RipassoExercise[];
  /** False when the database couldn't be read: the footer shows Offline. */
  loaded: boolean;
  children: ReactNode;
}) {
  const key = (exerciseId: string) => `${lessonId}|${visit}|${exerciseId}`;
  const [entries, setEntries] = useState<ReadonlyMap<string, ExerciseEntry>>(
    () =>
      new Map(
        exercises.flatMap(({ exerciseId, restored }) => {
          const entry = answered.get(key(exerciseId)) ?? restored;
          return entry ? [[exerciseId, entry] as const] : [];
        }),
      ),
  );
  useEffect(() => recordStepVisit({ lessonId, location }), [lessonId, location]);
  useEffect(() => {
    if (!loaded) progressQueue.reportUnreachable();
  }, [loaded]);

  // Never a point, whatever the first Check did (ADR-0005).
  const entry = (exerciseId: string): ExerciseEntry => {
    const found = entries.get(exerciseId) ?? NEW_ENTRY;
    return { ...found, state: { ...found.state, points: 0 } };
  };
  const dispatch = (exercise: Exercise, action: ExerciseAction) => {
    const chosen = exercises.find(({ exerciseId }) => exerciseId === exercise.id);
    const outcome = chosen && applyAction(exercise, entry(exercise.id), action);
    if (!chosen || !outcome) return;
    const first = !entries.has(exercise.id);
    answered.set(key(exercise.id), outcome.entry);
    setEntries((before) => new Map(before).set(exercise.id, outcome.entry));
    if (!first) return;
    submitReview({
      eventId: crypto.randomUUID(),
      cardId: chosen.cardId,
      exerciseId: chosen.exerciseId,
      contentHash: chosen.contentHash,
      at: new Date().toISOString(),
      source: "ripasso_personale",
      ...action,
    });
  };

  const counts = ripassoCounts(exercises.map(({ exerciseId }) => entry(exerciseId).state));
  return (
    <CountsContext value={counts}>
      <ExerciseProgress entry={entry} dispatch={dispatch}>
        {children}
      </ExerciseProgress>
    </CountsContext>
  );
}

/** The footer band's live counter (SPEC §6.2) for the step: its exercises, and no points. */
export function RipassoCounterText() {
  const counts = use(CountsContext);
  if (!counts) throw new Error("RipassoCounterText needs a <RipassoProgress> around it.");
  return <p aria-live="polite">{ui.lesson.footerCounter(counts)}</p>;
}
