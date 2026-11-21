"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { lessonPageHref, type ReviewPage } from "@/content/lesson-nav";
import { entriesVersion, entryOf, progressQueue, submitCorrection, submitFinish, subscribeEntries } from "@/progress/client";
import type { SavedEntry } from "@/progress/merge";
import { type LessonResults, lessonResults } from "@/progress/results";
import { type LessonShape, lessonExercises } from "@/scoring/lesson";
import { ui } from "@/ui-it";
import { AccentLink } from "./accent-link";

type ResultsProps = {
  /** Only what scoring reads (`lessonShape`). */
  shape: LessonShape;
  /** The lesson's saved entries; this tab's unconfirmed changes go over them. */
  saved: Record<string, SavedEntry>;
  /** False when the database couldn't be read: the footer shows Offline. */
  loaded: boolean;
};

/** The lesson's results from the saved entries with this tab's changes over them, live. */
function useLessonResults({ shape, saved, loaded }: ResultsProps): LessonResults {
  useSyncExternalStore(subscribeEntries, entriesVersion, () => 0);
  useEffect(() => {
    if (!loaded) progressQueue.reportUnreachable();
  }, [loaded]);
  const states = new Map(lessonExercises(shape).map(({ id }) => [id, entryOf(id, saved[id]).state]));
  return lessonResults(shape, states);
}

/** The slate panel (SPEC §4.4): the lesson % large, then S/M. */
function ScorePanel({ results }: { results: LessonResults }) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-2 bg-panel px-4 py-14 text-white">
      <p className="text-5xl font-bold">{ui.results.percent(results.percent)}</p>
      <p className="text-lg">{ui.results.steps(results.completedSteps, results.totalSteps)}</p>
    </div>
  );
}

/**
 * The Results screen (SPEC §4.4): the score-band line, the slate panel, the
 * review pages ahead, *Correggi i miei errori* (when there is something to
 * correct) and *Continua*.
 */
export function ResultsScreen({
  lesson,
  reviewPages,
  continueHref,
  ...props
}: ResultsProps & { lesson: { id: string; slug: string }; reviewPages: ReviewPage[]; continueHref: string }) {
  const results = useLessonResults(props);
  const router = useRouter();
  const { correction } = results;

  const correct = () => {
    if (!correction) return;
    submitCorrection(lesson.id, correction.reopen, props.saved);
    router.push(lessonPageHref(lesson, "esercizi", correction.stepNumber));
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand">{ui.results.heading}</h1>
      <p className="mt-6 text-lg">{ui.results.band[results.band]}</p>
      <ScorePanel results={results} />
      {reviewPages.length > 0 && <p className="mt-8 text-center text-lg">{ui.results.nextPages(reviewPages)}</p>}
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        {correction && (
          <button
            type="button"
            onClick={correct}
            className="rounded-full border-2 border-brand px-8 py-2 font-bold text-brand hover:bg-tint"
          >
            {ui.results.correct}
          </button>
        )}
        <AccentLink href={continueHref}>{ui.results.continue}</AccentLink>
      </div>
    </div>
  );
}

/**
 * The Finish screen (SPEC §4.9): the slate panel and a wide *Avanti*. Reaching
 * it completes the lesson.
 */
export function FinishScreen({ lessonId, nextHref, ...props }: ResultsProps & { lessonId: string; nextHref: string }) {
  const results = useLessonResults(props);
  useEffect(() => submitFinish(lessonId), [lessonId]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand">{ui.results.heading}</h1>
      <ScorePanel results={results} />
      <p className="mt-8 text-center text-lg">{ui.results.nextLesson}</p>
      <div className="mt-10 flex justify-center">
        <AccentLink href={nextHref} className="w-full max-w-sm text-center">
          {ui.lesson.next}
        </AccentLink>
      </div>
    </div>
  );
}
