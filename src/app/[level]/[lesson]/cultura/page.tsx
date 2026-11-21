import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MediaFrame } from "@/components/media-frame";
import { Prose } from "@/components/prose";
import { ReviewPage } from "@/components/review-page";
import { reviewNav } from "@/content/lesson-nav";
import { ui } from "@/ui-it";
import { type LessonRouteParams, lessonFromParams } from "../lesson-params";

/** The culture page (SPEC §4.7): a title, a large image and English prose with Italian key terms in bold. */
export default function CultureRoute({ params }: PageProps<"/[level]/[lesson]/cultura">) {
  return (
    <Suspense fallback={null}>
      <Culture params={params} />
    </Suspense>
  );
}

async function Culture({ params }: { params: Promise<LessonRouteParams> }) {
  const lesson = await lessonFromParams(params);
  const culture = lesson.culture ?? notFound();
  return (
    <ReviewPage heading={ui.lesson.culture} nav={reviewNav(lesson, "cultura")}>
      <article lang="en" className="mx-auto max-w-3xl px-4 py-8">
        <h2 className="text-2xl font-bold text-brand">{culture.title}</h2>
        <div className="mt-6">
          <MediaFrame src={culture.image} alt={culture.title} />
        </div>
        <Prose md={culture.md} className="mt-6 text-lg" />
      </article>
    </ReviewPage>
  );
}
