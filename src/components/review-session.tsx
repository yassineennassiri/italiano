"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { REVIEW_HUB_HREF } from "@/content/lesson-nav";
import { applyAction, type Exercise, type ExerciseAction } from "@/items/engine";
import { type ExerciseEntry, NEW_ENTRY } from "@/items/entry";
import { progressQueue, submitReview } from "@/progress/client";
import { reviewGrade } from "@/review/item-card";
import { type Grade, grades } from "@/review/sm2";
import { ui } from "@/ui-it";
import { ExerciseProgress } from "./step-progress";

/** What the session needs to write a card's review. */
export type ReviewCardView = { cardId: string; exerciseId: string; contentHash: string };

const BUTTON_CLASS = "inline-block rounded-full bg-accent px-8 py-2 font-bold text-foreground hover:brightness-95";

/**
 * A review session (SPEC §10.5): the cards one at a time, each in the normal
 * item UI (`slots`, rendered on the server). The first answer to a card
 * grades it and queues its review write; the item then behaves as in a
 * lesson, but nothing more is written. The lesson's own progress is never
 * read or changed. A summary closes the session, with *Altri 20* when more
 * cards are due.
 */
export function ReviewSession({ cards, slots, more }: { cards: ReviewCardView[]; slots: ReactNode[]; more: boolean }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [entries, setEntries] = useState<ReadonlyMap<string, ExerciseEntry>>(new Map());
  const [graded, setGraded] = useState<ReadonlyMap<string, Grade>>(new Map());
  const done = index >= cards.length;
  const card = cards[index];

  const leave = async (go: () => void) => {
    // The next page reads the cards: let the reviews land first.
    await progressQueue.settled();
    go();
  };

  if (done) {
    const counts = grades.map((grade) => [grade, [...graded.values()].filter((given) => given === grade).length] as const);
    return (
      <section className="mt-6 rounded-lg bg-tint px-6 py-8 text-center">
        <h2 className="text-2xl font-bold text-brand">{ui.review.summaryHeading}</h2>
        <p className="mt-3">{ui.review.summaryCount(graded.size)}</p>
        <ul className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1">
          {counts
            .filter(([, count]) => count > 0)
            .map(([grade, count]) => (
              <li key={grade}>{ui.review.gradeCount(grade, count)}</li>
            ))}
        </ul>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          {more && (
            <button type="button" className={BUTTON_CLASS} onClick={() => void leave(() => router.refresh())}>
              {ui.review.more}
            </button>
          )}
          <Link
            href={REVIEW_HUB_HREF}
            className="inline-block rounded-full border-2 border-brand px-8 py-2 font-bold text-brand hover:bg-tint"
            onClick={(event) => {
              event.preventDefault();
              void leave(() => router.push(REVIEW_HUB_HREF));
            }}
          >
            {ui.review.backToHub}
          </Link>
        </div>
      </section>
    );
  }

  const entry = (exerciseId: string) => entries.get(exerciseId) ?? NEW_ENTRY;
  const dispatch = (exercise: Exercise, action: ExerciseAction) => {
    const outcome = applyAction(exercise, entry(exercise.id), action);
    if (!outcome) return;
    setEntries((before) => new Map(before).set(exercise.id, outcome.entry));
    if (graded.has(card.cardId)) return;
    setGraded((before) => new Map(before).set(card.cardId, reviewGrade(outcome)));
    submitReview({
      eventId: crypto.randomUUID(),
      cardId: card.cardId,
      exerciseId: card.exerciseId,
      contentHash: card.contentHash,
      at: new Date().toISOString(),
      source: "hub",
      ...action,
    });
  };
  const last = index === cards.length - 1;

  return (
    <>
      <p className="mt-4 text-center text-sm tracking-widest text-muted">{ui.review.counter(index + 1, cards.length)}</p>
      <ExerciseProgress key={card.cardId} entry={entry} dispatch={dispatch}>
        {slots[index]}
      </ExerciseProgress>
      <div className="mt-10 bg-tint py-8 text-center">
        <button type="button" disabled={!graded.has(card.cardId)} className={`${BUTTON_CLASS} disabled:opacity-40`} onClick={() => setIndex(index + 1)}>
          {last ? ui.review.finish : ui.review.next}
        </button>
      </div>
    </>
  );
}
