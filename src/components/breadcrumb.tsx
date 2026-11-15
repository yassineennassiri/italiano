import Link from "next/link";
import { parseLessonId } from "@/content/ids";
import { lessonPath, levelPath } from "@/content/lesson-nav";
import type { Lesson } from "@/content/schema";
import { ui } from "@/ui-it";

/**
 * `A2 / Corso / Lesson / Step title`, only on the intro and step pages
 * (SPEC §3.1). Without a step title the lesson is the current page.
 */
export function Breadcrumb({ lesson, stepTitle }: { lesson: Lesson; stepTitle?: string }) {
  const crumbs: { label: string; href?: string }[] = [
    { label: ui.levelBadge(parseLessonId(lesson.id)!.level), href: "/" },
    { label: ui.lesson.course, href: levelPath(lesson) },
    { label: lesson.title, href: stepTitle === undefined ? undefined : `${lessonPath(lesson)}/info` },
    ...(stepTitle === undefined ? [] : [{ label: stepTitle }]),
  ];
  return (
    <nav aria-label={ui.lesson.breadcrumb} className="mx-auto max-w-6xl px-4 pt-4 text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {crumbs.map((crumb, index) => (
          <li key={index} className="flex items-center gap-2 before:text-muted not-first:before:content-['/']">
            {crumb.href ? (
              <Link href={crumb.href} className="font-semibold text-brand hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
