import type { Metadata } from "next";
import { Suspense } from "react";
import { AccentLink } from "@/components/accent-link";
import { CorrectionForm } from "@/components/correction-form";
import { REVIEW_SESSION_HREF } from "@/content/lesson-nav";
import { loadErrorTags } from "@/content/load";
import { readDueCards } from "@/progress/read";
import { dueSession } from "@/review/session";
import { ui } from "@/ui-it";

export const metadata: Metadata = { title: ui.review.pageTitle };

/** The review hub (SPEC §10.5): the *Da ripassare oggi* and *Aggiungi una correzione* panels. */
export default function ReviewHubPage() {
  const tags = loadErrorTags().map((tag) => ({ id: tag.id, explanation: tag.explanation_en }));
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold text-brand">{ui.review.heading}</h1>
      <section aria-labelledby="due-heading" className="mt-6 rounded-lg bg-tint px-6 py-6">
        <h2 id="due-heading" className="text-xl font-bold text-brand">
          {ui.review.dueHeading}
        </h2>
        <Suspense fallback={<p className="mt-3 h-6" />}>
          <DuePanel />
        </Suspense>
      </section>
      <section aria-labelledby="correction-heading" className="mt-6 rounded-lg bg-tint px-6 py-6">
        <h2 id="correction-heading" className="text-xl font-bold text-brand">
          {ui.review.correction.heading}
        </h2>
        <CorrectionForm tags={tags} />
      </section>
    </div>
  );
}

async function DuePanel() {
  const { due, loaded } = await readDueCards();
  const { total, counts } = dueSession(due, Math.random);
  if (!loaded) return <p className="mt-3 text-bad">{ui.review.unreachable}</p>;
  if (total === 0) return <p className="mt-3">{ui.review.nothingDue}</p>;
  return (
    <>
      <p className="mt-3 text-lg">{ui.review.dueCount(counts)}</p>
      <AccentLink href={REVIEW_SESSION_HREF} className="mt-5">
        {ui.review.start}
      </AccentLink>
    </>
  );
}
