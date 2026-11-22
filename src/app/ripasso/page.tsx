import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AccentLink } from "@/components/accent-link";
import { CorrectionForm } from "@/components/correction-form";
import { drillHref, REVIEW_SESSION_HREF } from "@/content/lesson-nav";
import { loadErrorTags } from "@/content/load";
import { readDueCards, readTopErrorTags } from "@/progress/read";
import { dueSession } from "@/review/session";
import { RECENT_DAYS } from "@/review/top-tags";
import { ui } from "@/ui-it";

export const metadata: Metadata = { title: ui.review.pageTitle };

/** The review hub (SPEC §10.5): the *Da ripassare oggi*, *I miei errori più frequenti* and *Aggiungi una correzione* panels. */
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
      <section aria-labelledby="top-tags-heading" className="mt-6 rounded-lg bg-tint px-6 py-6">
        <h2 id="top-tags-heading" className="text-xl font-bold text-brand">
          {ui.review.topTags.heading}
        </h2>
        <Suspense fallback={<p className="mt-3 h-6" />}>
          <TopTagsPanel />
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

/** The top 5 error tags, each a link that starts its tag drill. */
async function TopTagsPanel() {
  const { top, loaded } = await readTopErrorTags();
  if (!loaded) return <p className="mt-3 text-bad">{ui.review.unreachable}</p>;
  if (top.length === 0) return <p className="mt-3">{ui.review.topTags.none(RECENT_DAYS)}</p>;
  return (
    <>
      <p className="mt-3">{ui.review.topTags.intro(RECENT_DAYS)}</p>
      <ul className="mt-4 space-y-3">
        {top.map((tag) => (
          <li key={tag.id}>
            <Link href={drillHref(tag.id)} className="block rounded-lg border-2 border-line bg-background px-4 py-3 hover:border-brand">
              <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="font-semibold text-brand underline">{tag.id}</span>
                <span className="text-sm text-muted">{ui.review.topTags.count(tag.count)}</span>
              </span>
              <span lang="en" className="mt-1 block text-sm">
                {tag.explanation}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
