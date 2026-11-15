/**
 * What the Home page and the level overview show, built from the content
 * files (SPEC §3.2, §3.3). Progress is not part of it; pages add that later.
 * Server-only: it reads content from disk.
 */
import { loadCourse, loadLesson } from "./load";
import type { LevelId } from "./ids";

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
          href: `/${level.id}/${lesson.slug}`,
        };
      }),
    })),
  };
}
