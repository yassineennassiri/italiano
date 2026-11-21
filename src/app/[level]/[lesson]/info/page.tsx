import { Suspense } from "react";
import { AccentLink } from "@/components/accent-link";
import { Breadcrumb } from "@/components/breadcrumb";
import { ScenePlayer } from "@/components/scene-player";
import { lessonPageHref } from "@/content/lesson-nav";
import { ui } from "@/ui-it";
import { type LessonRouteParams, lessonFromParams } from "../lesson-params";

/** The intro page (SPEC §4.1): poster, topic, summary, objectives and Inizia. */
export default function IntroPage({ params }: PageProps<"/[level]/[lesson]/info">) {
  return (
    <Suspense fallback={null}>
      <Intro params={params} />
    </Suspense>
  );
}

async function Intro({ params }: { params: Promise<LessonRouteParams> }) {
  const lesson = await lessonFromParams(params);
  return (
    <>
      <Breadcrumb lesson={lesson} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <ScenePlayer scene={lesson.scene} lessonTitle={lesson.title} />
        <div className="mx-auto mt-8 max-w-3xl">
          <h1 className="text-3xl font-bold text-brand">{lesson.topic}</h1>
          <p className="mt-4 text-lg">{lesson.summary}</p>
          <h2 className="mt-6 font-bold">{ui.lesson.objectives}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {lesson.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
          <AccentLink href={lessonPageHref(lesson, "esercizi", 1)} className="mt-8">
            {ui.lesson.start}
          </AccentLink>
        </div>
      </div>
    </>
  );
}
