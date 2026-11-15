import { redirect } from "next/navigation";
import { Suspense } from "react";
import { lessonPageHref } from "@/content/lesson-nav";
import { type LessonRouteParams, lessonFromParams } from "./lesson-params";

/** `/:level/:lesson` opens the intro; resuming at the last visited step comes with progress. */
export default function LessonEntry({ params }: PageProps<"/[level]/[lesson]">) {
  return (
    <Suspense fallback={null}>
      <RedirectToIntro params={params} />
    </Suspense>
  );
}

async function RedirectToIntro({ params }: { params: Promise<LessonRouteParams> }): Promise<never> {
  redirect(lessonPageHref(await lessonFromParams(params), "info"));
}
