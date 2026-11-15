import Link from "next/link";
import { Suspense } from "react";
import { Breadcrumb } from "@/components/breadcrumb";
import { ScenePoster } from "@/components/scene-poster";
import { lessonPath } from "@/content/lesson-nav";
import { ui } from "@/ui-it";
import { type LessonParams, lessonFromParams } from "../lesson-params";

/** The intro page (SPEC §4.1): poster, topic, summary, objectives and Inizia. */
export default function IntroPage({ params }: PageProps<"/[level]/[lesson]/info">) {
  return (
    <Suspense fallback={null}>
      <Intro params={params} />
    </Suspense>
  );
}

async function Intro({ params }: { params: LessonParams }) {
  const lesson = await lessonFromParams(params);
  return (
    <>
      <Breadcrumb lesson={lesson} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <ScenePoster scene={lesson.scene} lessonTitle={lesson.title} />
        <div className="mx-auto mt-8 max-w-3xl">
          <h1 className="text-3xl font-bold text-brand">{lesson.topic}</h1>
          <p className="mt-4 text-lg">{lesson.summary}</p>
          <h2 className="mt-6 font-bold">{ui.lesson.objectives}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {lesson.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
          <Link
            href={`${lessonPath(lesson)}/esercizi/1`}
            className="mt-8 inline-block rounded-full bg-accent px-8 py-2 font-bold text-foreground hover:brightness-95"
          >
            {ui.lesson.start}
          </Link>
        </div>
      </div>
    </>
  );
}
