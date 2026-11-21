import { Suspense } from "react";
import { ResultsScreen } from "@/components/lesson-results";
import { reviewPages, reviewStartHref } from "@/content/lesson-nav";
import { readLessonEntries } from "@/progress/read";
import { lessonShape } from "@/scoring/lesson";
import { type LessonRouteParams, lessonFromParams } from "../lesson-params";

/** Results (SPEC §4.4): the lesson %, S/M, Correggi i miei errori and Continua. No breadcrumb (§3.1). */
export default function ResultsPage({ params }: PageProps<"/[level]/[lesson]/risultati">) {
  return (
    <Suspense fallback={null}>
      <Results params={params} />
    </Suspense>
  );
}

async function Results({ params }: { params: Promise<LessonRouteParams> }) {
  const lesson = await lessonFromParams(params);
  const { saved, loaded } = await readLessonEntries(lesson);
  return (
    <ResultsScreen
      lesson={{ id: lesson.id, slug: lesson.slug }}
      shape={lessonShape(lesson)}
      saved={saved}
      loaded={loaded}
      reviewPages={reviewPages(lesson)}
      continueHref={reviewStartHref(lesson)}
    />
  );
}
