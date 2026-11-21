/**
 * What the Home page and the level overview show, built from the content
 * files (SPEC §3.2, §3.3). Progress is not part of it; pages add that later.
 * Server-only: it reads content from disk.
 */
import { loadCourse, loadLesson } from "./load";
import type { LevelId } from "./ids";
import { lessonPageHref, lessonPath } from "./lesson-nav";
import type { LessonStatus } from "@/scoring/lesson";

export type LessonCard = {
  id: string;
  title: string;
  topic: string;
  grammarLabel?: string;
  /** Draft lessons show a Bozza badge; they are playable all the same. */
  draft: boolean;
  href: string;
};

export type UnitGroup = {
  id: string;
  number: number;
  title: string;
  /** Empty for a unit with no lesson files yet: it shows one In arrivo card. */
  lessons: LessonCard[];
};

export type LevelOverview = {
  id: LevelId;
  title: string;
  units: UnitGroup[];
};

export type LevelCard = {
  id: LevelId;
  title: string;
  description: string;
  /** False until the level has a lesson file: the card is disabled, In arrivo. */
  available: boolean;
  href: string;
};

/** The level cards on the Home page, in course order. */
export function homeLevels(contentDir?: string): LevelCard[] {
  return loadCourse(contentDir).levels.map((level) => ({
    id: level.id,
    title: level.title,
    description: level.description,
    available: level.units.some((unit) => unit.lessons.length > 0),
    href: `/${level.id}`,
  }));
}

/** The level overview's query that shows the *Livello completato* banner. */
export const LEVEL_COMPLETED_PARAM = "completato";

/**
 * Where Avanti on the Finish screen goes (SPEC §4.9): the next lesson's intro
 * in course order, or after the level's last written lesson, the level
 * overview with the *Livello completato* banner.
 */
export function finishTarget(lessonId: string, contentDir?: string): { href: string; levelCompleted: boolean } {
  const level = loadCourse(contentDir).levels.find((candidate) => candidate.units.some((unit) => unit.lessons.includes(lessonId)));
  if (!level) throw new Error(`course.json doesn't list ${lessonId}`);
  const lessons = level.units.flatMap((unit) => unit.lessons);
  const nextId = lessons[lessons.indexOf(lessonId) + 1];
  const next = nextId === undefined ? undefined : loadLesson(nextId, contentDir);
  return next
    ? { href: lessonPageHref(next, "info"), levelCompleted: false }
    : { href: `/${level.id}?${LEVEL_COMPLETED_PARAM}=1`, levelCompleted: true };
}

/**
 * Where *Continua da dove eri* goes (SPEC §3.2): back into the most recently
 * played lesson (its route resumes at the last step), or on to the next
 * lesson's intro once that one is completed. With nothing played, the first
 * written lesson.
 */
export function continueHref(
  recentFirst: readonly { lessonId: string; status: LessonStatus }[],
  contentDir?: string,
): string {
  for (const { lessonId, status } of recentFirst) {
    const lesson = loadLesson(lessonId, contentDir);
    if (!lesson) continue;
    if (status === "completed") {
      const next = finishTarget(lessonId, contentDir);
      if (!next.levelCompleted) return next.href;
    }
    return lessonPath(lesson);
  }
  const firstId = loadCourse(contentDir).levels.flatMap((level) => level.units.flatMap((unit) => unit.lessons))[0];
  return lessonPath(loadLesson(firstId, contentDir)!);
}

/** The level overview, or undefined for a level the course doesn't have. */
export function levelOverview(levelId: string, contentDir?: string): LevelOverview | undefined {
  const level = loadCourse(contentDir).levels.find((candidate) => candidate.id === levelId);
  if (!level) return undefined;

  return {
    id: level.id,
    title: level.title,
    units: level.units.map((unit) => ({
      id: unit.id,
      number: unit.number,
      title: unit.title,
      lessons: unit.lessons.map((lessonId) => {
        const lesson = loadLesson(lessonId, contentDir);
        if (!lesson) throw new Error(`course.json lists ${lessonId}, but no lesson file has it (run npm run content:check)`);
        return {
          id: lesson.id,
          title: lesson.title,
          topic: lesson.topic,
          grammarLabel: lesson.grammar_label,
          draft: lesson.status === "draft",
          href: lessonPath(lesson),
        };
      }),
    })),
  };
}
