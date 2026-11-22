"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { REVIEW_HUB_HREF } from "@/content/lesson-nav";
import { applyAction, type Exercise, type ExerciseAction } from "@/items/engine";
import { type ExerciseEntry, NEW_ENTRY } from "@/items/entry";
import { progressQueue, submitReview } from "@/progress/client";
import { reviewGrade } from "@/review/item-card";
import { countByKind, type SessionCardKind } from "@/review/kinds";
import type { ItemSessionCard, VocabSessionCard } from "@/review/session";
import { type Grade, grades } from "@/review/sm2";
import { ui } from "@/ui-it";
import { ACCENT_CLASS } from "./accent-link";
import { ExerciseProgress } from "./step-progress";
import { VocabFlipCard } from "./vocab-flip-card";

/**
 * What the session needs of a card: to write an item card's review (its item
 * UI comes as a slot), or to show a vocab card and write its grade.
 */
export type ReviewCardView =
  | Pick<ItemSessionCard, "kind" | "cardId" | "exerciseId" | "contentHash">
  | (Pick<VocabSessionCard, "kind" | "cardId" | "entry"> & { source: string });


/**
 * A review session (SPEC §10.5): the cards one at a time. An item card shows
 * its item in the normal item UI (`slots`, rendered on the server); the
 * first answer grades it and queues its review write, and the item then
 * behaves as in a lesson, but nothing more is written. A vocab card is a flip
 * card: its grade button queues the write and moves on. The lesson's own
 * progress is never read or changed. A summary closes the session, with
 * *Altri 20* when more cards are due.
 */
export function ReviewSession({
  cards,
  slots,
  more,
  sessionSize,
}: {
  cards: ReviewCardView[];
  /** Each item card's item UI; null for a vocab card. */
  slots: ReactNode[];
  /** More cards are due than this session holds. */
  more: boolean;
  /** How many cards a session holds, for *Altri 20*. */
  sessionSize: number;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [entries, setEntries] = useState<ReadonlyMap<string, ExerciseEntry>>(new Map());
  const [graded, setGraded] = useState<ReadonlyMap<string, { kind: SessionCardKind; grade: Grade }>>(new Map());
  const done = index >= cards.length;
  const card = cards[index];

  const leave = async (go: () => void) => {
    // The next page reads the cards: let the reviews land first.
    await progressQueue.settled();
    go();
  };

  if (done) {
    const answers = [...graded.values()];
    const counts = grades.map((grade) => [grade, answers.filter((answer) => answer.grade === grade).length] as const);

    return (
      <section className="mt-6 rounded-lg bg-tint px-6 py-8 text-center">
        <h2 className="text-2xl font-bold text-brand">{ui.review.summaryHeading}</h2>
        <p className="mt-3">{ui.review.summaryCount(countByKind(answers))}</p>
        <ul className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1">
          {counts
            .filter(([, count]) => count > 0)
            .map(([grade, count]) => (
              <li key={grade}>{ui.review.gradeCount(grade, count)}</li>
            ))}
        </ul>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          {more && (
            <button type="button" className={ACCENT_CLASS} onClick={() => void leave(() => router.refresh())}>
              {ui.review.more(sessionSize)}
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

  const counter = <p className="mt-4 text-center text-sm tracking-widest text-muted">{ui.review.counter(index + 1, cards.length)}</p>;

  if (card.kind === "vocab") {
    const grade = (given: Grade) => {
      setGraded((before) => new Map(before).set(card.cardId, { kind: "vocab", grade: given }));
      submitReview({ eventId: crypto.randomUUID(), cardId: card.cardId, at: new Date().toISOString(), source: "hub", kind: "grade", grade: given });
      setIndex(index + 1);
    };
    return (
      <>
        {counter}
        <VocabFlipCard key={card.cardId} entry={card.entry} source={card.source} autoFocus={index > 0} onGrade={grade} />
      </>
    );
  }

  const entry = (exerciseId: string) => entries.get(exerciseId) ?? NEW_ENTRY;
  const dispatch = (exercise: Exercise, action: ExerciseAction) => {
    const outcome = applyAction(exercise, entry(exercise.id), action);
    if (!outcome) return;
    setEntries((before) => new Map(before).set(exercise.id, outcome.entry));
    if (graded.has(card.cardId)) return;
    setGraded((before) => new Map(before).set(card.cardId, { kind: "item", grade: reviewGrade(outcome) }));
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
      {counter}
      <ExerciseProgress key={card.cardId} entry={entry} dispatch={dispatch}>
        {slots[index]}
      </ExerciseProgress>
      <div className="mt-10 bg-tint py-8 text-center">
        <button type="button" disabled={!graded.has(card.cardId)} className={`${ACCENT_CLASS} disabled:opacity-40`} onClick={() => setIndex(index + 1)}>
          {last ? ui.review.finish : ui.review.next}
        </button>
      </div>
    </>
  );
}
