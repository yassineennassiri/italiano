import { Suspense } from "react";
import { FinishScreen } from "@/components/lesson-results";
import { finishTarget } from "@/content/overview";
import { readLessonEntries } from "@/progress/read";
import { lessonShape } from "@/scoring/lesson";
import { type LessonRouteParams, lessonFromParams } from "../lesson-params";

/**
 * Finish (SPEC §4.9): its heading is also Risultati della lezione. Reaching it
 * completes the lesson; Avanti goes to the next lesson, or after the level's
 * last one to the level overview with Livello completato.
 */
export default function FinishPage({ params }: PageProps<"/[level]/[lesson]/fine">) {
  return (
    <Suspense fallback={null}>
      <Finish params={params} />
    </Suspense>
  );
}

async function Finish({ params }: { params: Promise<LessonRouteParams> }) {
  const lesson = await lessonFromParams(params);
  const { saved, loaded } = await readLessonEntries(lesson);
  return (
    <FinishScreen
      lessonId={lesson.id}
      shape={lessonShape(lesson)}
      saved={saved}
      loaded={loaded}
      nextHref={finishTarget(lesson.id).href}
    />
  );
}
