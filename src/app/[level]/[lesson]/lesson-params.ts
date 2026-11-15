/** Resolving `/:level/:lesson` to a loaded lesson, shared by the lesson's pages. */
import { notFound } from "next/navigation";
import { loadCourse, loadLesson, loadLessonBySlug } from "@/content/load";
import type { Lesson } from "@/content/schema";

export type LessonParams = Promise<{ level: string; lesson: string }>;

/** The lesson the URL names, or the 404 page. */
export async function lessonFromParams(params: LessonParams): Promise<Lesson> {
  const { level, lesson: slug } = await params;
  return loadLessonBySlug(level, slug) ?? notFound();
}

/** Every lesson's `{ level, lesson }`, for prerendering. */
export function allLessonParams(): { level: string; lesson: string }[] {
  return loadCourse().levels.flatMap((level) =>
    level.units.flatMap((unit) =>
      unit.lessons.map((lessonId) => ({ level: level.id, lesson: loadLesson(lessonId)!.slug })),
    ),
  );
}
