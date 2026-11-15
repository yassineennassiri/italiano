/** Resolving `/:level/:lesson` to a loaded lesson, shared by the lesson's pages. */
import { notFound } from "next/navigation";
import { loadCourse, loadLesson, loadLessonBySlug } from "@/content/load";
import type { Lesson } from "@/content/schema";

/** The params of every route under `/:level/:lesson`. */
export type LessonRouteParams = Awaited<LayoutProps<"/[level]/[lesson]">["params"]>;

/** The lesson the URL names, or the 404 page. */
export async function lessonFromParams(params: Promise<LessonRouteParams>): Promise<Lesson> {
  const { level, lesson: slug } = await params;
  return loadLessonBySlug(level, slug) ?? notFound();
}

/** Every lesson's params, for prerendering. */
export function allLessonParams(): LessonRouteParams[] {
  return loadCourse().levels.flatMap((level) =>
    level.units.flatMap((unit) =>
      unit.lessons.map((lessonId) => ({ level: level.id, lesson: loadLesson(lessonId)!.slug })),
    ),
  );
}
