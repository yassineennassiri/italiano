import type { Metadata } from "next";
import { Suspense } from "react";
import { AccentLink } from "@/components/accent-link";
import { REVIEW_SESSION_HREF } from "@/content/lesson-nav";
import { readDueCards } from "@/progress/read";
import { ui } from "@/ui-it";

export const metadata: Metadata = { title: ui.review.pageTitle };

/** The review hub (SPEC §10.5), v0: the *Da ripassare oggi* panel. */
export default function ReviewHubPage() {
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
    </div>
  );
}

async function DuePanel() {
  const { total, loaded } = await readDueCards(0);
  if (!loaded) return <p className="mt-3 text-bad">{ui.review.unreachable}</p>;
  if (total === 0) return <p className="mt-3">{ui.review.nothingDue}</p>;
  return (
    <>
      <p className="mt-3 text-lg">{ui.review.dueCount(total)}</p>
      <AccentLink href={REVIEW_SESSION_HREF} className="mt-5">
        {ui.review.start}
      </AccentLink>
    </>
  );
}
