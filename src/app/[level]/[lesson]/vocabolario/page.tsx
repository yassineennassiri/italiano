import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReviewPage } from "@/components/review-page";
import { VocabList } from "@/components/vocab-list";
import { hasPage, reviewNav } from "@/content/lesson-nav";
import { sortVocab } from "@/content/vocab";
import { ui } from "@/ui-it";
import { type LessonRouteParams, lessonFromParams } from "../lesson-params";

/** The vocabulary page (SPEC §4.6): the lesson's words, sorted ignoring the article. */
export default function VocabularyRoute({ params }: PageProps<"/[level]/[lesson]/vocabolario">) {
  return (
    <Suspense fallback={null}>
      <Vocabulary params={params} />
    </Suspense>
  );
}

async function Vocabulary({ params }: { params: Promise<LessonRouteParams> }) {
  const lesson = await lessonFromParams(params);
  if (!hasPage(lesson, "vocabolario")) notFound();
  return (
    <ReviewPage heading={ui.lesson.vocabulary} nav={reviewNav(lesson, "vocabolario")}>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <VocabList entries={sortVocab(lesson.vocab)} />
      </div>
    </ReviewPage>
  );
}
