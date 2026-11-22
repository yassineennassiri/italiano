import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReviewItem } from "@/components/review-item";
import { ReviewSession } from "@/components/review-session";
import { REVIEW_HUB_HREF } from "@/content/lesson-nav";
import { loadErrorTags, loadLesson } from "@/content/load";
import { readDrillSources } from "@/progress/read";
import { DRILL_SIZE, drillExercises } from "@/review/drill";
import { ui } from "@/ui-it";

export const metadata: Metadata = { title: ui.review.pageTitle };

/**
 * A tag drill (SPEC §10.5): up to 10 exercises carrying the error tag, from
 * completed lessons, in the normal item UI. Graded like a review: an
 * exercise's existing item card is updated, and no card is created.
 */
export default function DrillPage({ params }: PageProps<"/ripasso/errori/[tag]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={null}>
        <Drill params={params} />
      </Suspense>
    </div>
  );
}

async function Drill({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: tagId } = await params;
  const errorTags = new Map(loadErrorTags().map((tag) => [tag.id, tag]));
  const tag = errorTags.get(tagId);
  if (!tag) notFound();

  const { progress, carded, loaded } = await readDrillSources();
  const exercises = drillExercises({ tag: tag.id, progress, load: loadLesson, carded, random: Math.random });
  const heading = (
    <>
      <h1 className="text-3xl font-bold text-brand">{ui.review.drill.heading(tag.id)}</h1>
      <p lang="en" className="mt-2 text-muted">
        {tag.explanation_en}
      </p>
    </>
  );
  if (exercises.length === 0) {
    return (
      <>
        {heading}
        <p className="mt-6">
          {loaded ? ui.review.drill.none : ui.review.unreachable}{" "}
          <Link href={REVIEW_HUB_HREF} className="font-semibold text-brand underline">
            {ui.review.backToHub}
          </Link>
        </p>
      </>
    );
  }
  return (
    <>
      {heading}
      <ReviewSession
        // Each visit is a new drill, started from its first exercise.
        key={randomUUID()}
        cards={exercises.map(({ kind, exerciseId, contentHash }) => ({ kind, exerciseId, contentHash }))}
        slots={exercises.map((exercise) => (
          <ReviewItem key={exercise.exerciseId} shown={exercise} errorTags={errorTags} />
        ))}
        more={false}
        sessionSize={DRILL_SIZE}
      />
    </>
  );
}
