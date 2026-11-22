import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Suspense } from "react";
import { ItemSlot, StepMedia } from "@/components/item-slot";
import { ReviewSession } from "@/components/review-session";
import { StepInstruction } from "@/components/step-instruction";
import { StepReading } from "@/components/step-reading";
import { REVIEW_HUB_HREF } from "@/content/lesson-nav";
import { loadErrorTags } from "@/content/load";
import { readingLayout } from "@/content/reading";
import { readDueCards } from "@/progress/read";
import { SESSION_SIZE, sessionCards } from "@/review/session";
import { ui } from "@/ui-it";

export const metadata: Metadata = { title: ui.review.pageTitle };

/** A review session (SPEC §10.5): up to 20 due cards, shuffled, one at a time. */
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
  const due = await readDueCards(SESSION_SIZE);
  const cards = sessionCards(due.cards, Math.random);
  if (cards.length === 0) {
    return (
      <p className="mt-6">
        {due.loaded ? ui.review.nothingDue : ui.review.unreachable}{" "}
        <Link href={REVIEW_HUB_HREF} className="font-semibold text-brand underline">
          {ui.review.backToHub}
        </Link>
      </p>
    );
  }
  const errorTags = new Map(loadErrorTags().map((tag) => [tag.id, tag]));
  const slots = cards.map(({ cardId, lesson, step, item }) => (
    <div key={cardId} className="mx-auto max-w-3xl">
      <p className="mt-2 text-sm text-muted">{ui.review.source(lesson.title, step.title)}</p>
      <StepMedia step={step} lesson={lesson} />
      <StepInstruction instruction={step.instruction} instructionEn={step.instruction_en} />
      {step.reading && <StepReading md={step.reading} layout={readingLayout(step)} />}
      <div className="mt-8">
        <ItemSlot item={item} scene={lesson.scene} errorTags={errorTags} />
      </div>
    </div>
  ));
  return (
    <ReviewSession
      // A new session (Altri 20) starts from its first card.
      key={randomUUID()}
      cards={cards.map(({ cardId, exerciseId, contentHash }) => ({ cardId, exerciseId, contentHash }))}
      slots={slots}
      more={due.total > due.cards.length}
    />
  );
}
