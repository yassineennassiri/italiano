import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Suspense } from "react";
import { ReviewItem } from "@/components/review-item";
import { ReviewSession } from "@/components/review-session";
import { REVIEW_HUB_HREF } from "@/content/lesson-nav";
import { loadErrorTags } from "@/content/load";
import { readDueCards } from "@/progress/read";
import { dueSession, SESSION_SIZE } from "@/review/session";
import { ui } from "@/ui-it";

export const metadata: Metadata = { title: ui.review.pageTitle };

/** A review session (SPEC §10.5): up to 20 due vocab, item and error cards, shuffled, one at a time. */
export default function ReviewSessionPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold text-brand">{ui.review.heading}</h1>
      <Suspense fallback={null}>
        <Session />
      </Suspense>
    </div>
  );
}

async function Session() {
  const { due, loaded } = await readDueCards();
  const { total, cards } = dueSession(due, Math.random);
  if (cards.length === 0) {
    return (
      <p className="mt-6">
        {loaded ? ui.review.nothingDue : ui.review.unreachable}{" "}
        <Link href={REVIEW_HUB_HREF} className="font-semibold text-brand underline">
          {ui.review.backToHub}
        </Link>
      </p>
    );
  }
  const errorTags = new Map(loadErrorTags().map((tag) => [tag.id, tag]));
  const slots = cards.map((card) =>
    card.kind === "item" ? <ReviewItem key={card.cardId} shown={card} errorTags={errorTags} /> : null,
  );
  return (
    <ReviewSession
      // A new session (Altri 20) starts from its first card.
      key={randomUUID()}
      cards={cards.map((card) => {
        switch (card.kind) {
          case "item":
            return { kind: card.kind, cardId: card.cardId, exerciseId: card.exerciseId, contentHash: card.contentHash };
          case "vocab":
            return { kind: card.kind, cardId: card.cardId, entry: card.entry, source: ui.review.source(card.lesson.title, ui.lesson.vocabulary) };
          case "error":
            return card;
        }
      })}
      slots={slots}
      more={total > cards.length}
      sessionSize={SESSION_SIZE}
    />
  );
}
