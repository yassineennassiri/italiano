/**
 * Server-side content loader. Reads the JSON under `content/` from disk and
 * validates it with the Zod schemas, so every page gets typed, checked data.
 * Uses `node:fs`: import it from Server Components and Route Handlers only.
 *
 * Every function takes an optional content directory (the tests point it at a
 * copy); by default it reads `content/` in the project root.
 */
import path from "node:path";
import { findLessonFiles, readContentFile } from "./files";
import { type Course, courseSchema, errorTagsSchema, type Lesson, lessonSchema } from "./schema";

const CONTENT_DIR = path.join(process.cwd(), "content");

export function loadCourse(contentDir = CONTENT_DIR): Course {
  return readContentFile(contentDir, "course.json", courseSchema);
}

/** The first lesson file whose path matches and whose content passes `matches`. */
function loadLessonWhere(
  contentDir: string,
  filePattern: RegExp,
  matches: (lesson: Lesson) => boolean,
): Lesson | undefined {
  for (const file of findLessonFiles(contentDir).filter((file) => filePattern.test(file))) {
    const lesson = readContentFile(contentDir, file, lessonSchema);
    if (matches(lesson)) return lesson;
  }
  return undefined;
}

/** A lesson by id (`a2.u01.l01`), or undefined when no file has it. */
export function loadLesson(lessonId: string, contentDir = CONTENT_DIR): Lesson | undefined {
  const match = /^(a2|b1|b2)\.u(\d{2})\.l(\d{2})$/.exec(lessonId);
  if (!match) return undefined;
  const [, level, unit, number] = match;
  // content:check guarantees the file name starts with the lesson's numbers.
  const filePattern = new RegExp(`^levels/${level}/units/${unit}-[^/]+/lessons/${number}-`);
  return loadLessonWhere(contentDir, filePattern, (lesson) => lesson.id === lessonId);
}

/** A lesson by the level and slug in its URL (`/a2/benvenuto-a-genova`). */
export function loadLessonBySlug(level: string, slug: string, contentDir = CONTENT_DIR): Lesson | undefined {
  if (!/^[a-z0-9-]+$/.test(level) || !/^[a-z0-9-]+$/.test(slug)) return undefined;
  const filePattern = new RegExp(`^levels/${level}/units/[^/]+/lessons/\\d{2}-${slug}\\.json$`);
  return loadLessonWhere(contentDir, filePattern, (lesson) => lesson.slug === slug);
}

export type ErrorTag = {
  id: string;
  explanation_en: string;
  /** The unit that teaches the tag, if any. */
  unit?: string;
  /** The first grammar page of that unit's first lesson; null until the unit has a lesson. */
  href: string | null;
};

/** All error tags, each linked to the grammar page that teaches it when one exists. */
export function loadErrorTags(contentDir = CONTENT_DIR): ErrorTag[] {
  const tags = readContentFile(contentDir, "error-tags.json", errorTagsSchema);
  const units = new Map(
    loadCourse(contentDir).levels.flatMap((level) => level.units.map((unit) => [unit.id, { level, unit }])),
  );

  const grammarHref = (unitId: string | undefined): string | null => {
    const found = unitId ? units.get(unitId) : undefined;
    const firstLessonId = found?.unit.lessons[0];
    const lesson = firstLessonId ? loadLesson(firstLessonId, contentDir) : undefined;
    if (!found || !lesson || lesson.grammar.length === 0) return null;
    return `/${found.level.id}/${lesson.slug}/grammatica/1`;
  };

  return Object.entries(tags).map(([id, tag]) => ({ id, ...tag, href: grammarHref(tag.unit) }));
}
