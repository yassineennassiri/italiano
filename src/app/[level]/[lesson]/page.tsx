import { redirect } from "next/navigation";
import { Suspense } from "react";
import { resumeHref } from "@/content/lesson-nav";
import { readLastLocation } from "@/progress/read";
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
  redirect(resumeHref(lesson, await readLastLocation(lesson.id)));
}
