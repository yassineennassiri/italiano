import { redirect } from "next/navigation";
import { Suspense } from "react";
import { parseStepLocation, resumeHref } from "@/content/lesson-nav";
import { readLastLocation, readStepLayout } from "@/progress/read";
import { type LessonRouteParams, lessonFromParams } from "./lesson-params";

/** `/:level/:lesson` resumes at the last visited step, or opens the intro (SPEC §3). */
export default function LessonEntry({ params }: PageProps<"/[level]/[lesson]">) {
  return (
    <Suspense fallback={null}>
      <ResumeLesson params={params} />
    </Suspense>
  );
}

async function ResumeLesson({ params }: { params: Promise<LessonRouteParams> }): Promise<never> {
  const lesson = await lessonFromParams(params);
  const lastLocation = await readLastLocation(lesson.id);
  // A step number counts the visit's Ripasso personale step, if it has one (ADR-0005).
  const layout = parseStepLocation(lastLocation) === undefined ? undefined : (await readStepLayout(lesson)).layout;
  redirect(resumeHref(lesson, lastLocation, layout));
}
