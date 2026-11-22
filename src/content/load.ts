/**
 * Server-side content loader. Reads the JSON under `content/` from disk and
 * validates it with the Zod schemas, so every page gets typed, checked data.
 * Uses `node:fs`: import it from Server Components and Route Handlers only.
 *
 * Every function takes an optional content directory (the tests point it at a
 * copy); by default it reads `content/` in the project root.
 */
import { CONTENT_DIR, findLessonFiles, readContentFile } from "./files";
import { lessonFilePattern, lessonIdOfGrammarPage, parseLessonId } from "./ids";
import { lessonPageHref } from "./lesson-nav";
import { type Course, courseSchema, type ErrorTagEntry, errorTagsSchema, type Lesson, lessonSchema } from "./schema";
import { withPlainVocabLinks } from "./vocab-links";

export function loadCourse(contentDir = CONTENT_DIR): Course {
  return readContentFile(contentDir, "course.json", courseSchema);
}

/**
 * The first lesson file whose path matches and whose content passes `matches`.
 * Vocab links come back as plain words, so every page shows `word` until the
 * popovers render them; `content:check` still sees the markup.
 */
function loadLessonWhere(
  contentDir: string,
  filePattern: RegExp,
  matches: (lesson: Lesson) => boolean,
): Lesson | undefined {
  for (const file of findLessonFiles(contentDir).filter((file) => filePattern.test(file))) {
    const lesson = readContentFile(contentDir, file, lessonSchema);
    if (matches(lesson)) return withPlainVocabLinks(lesson);
  }
  return undefined;
}

/** A lesson by id (`a2.u01.l01`), or undefined when no file has it. */
export function loadLesson(lessonId: string, contentDir = CONTENT_DIR): Lesson | undefined {
  const id = parseLessonId(lessonId);
  if (!id) return undefined;
  // content:check guarantees the file name starts with the lesson's numbers.
  return loadLessonWhere(contentDir, lessonFilePattern(id), (lesson) => lesson.id === lessonId);
}

/** A lesson by the level and slug in its URL (`/a2/benvenuto-a-genova`). */
export function loadLessonBySlug(level: string, slug: string, contentDir = CONTENT_DIR): Lesson | undefined {
  if (!/^[a-z0-9-]+$/.test(level) || !/^[a-z0-9-]+$/.test(slug)) return undefined;
  const filePattern = new RegExp(`^levels/${level}/units/[^/]+/lessons/\\d{2}-${slug}\\.json$`);
  return loadLessonWhere(contentDir, filePattern, (lesson) => lesson.slug === slug);
}

export type ErrorTag = ErrorTagEntry & {
  id: string;
  /** The grammar page that teaches the tag; null until its unit has a lesson. */
  href: string | null;
};

/**
 * All error tags, each linked to the grammar page that teaches it: the page the
 * tag names, or else the first grammar page of its unit's first lesson.
 */
export function loadErrorTags(contentDir = CONTENT_DIR): ErrorTag[] {
  const tags = readContentFile(contentDir, "error-tags.json", errorTagsSchema);
  const units = new Map(
    loadCourse(contentDir).levels.flatMap((level) => level.units.map((unit) => [unit.id, unit])),
  );
  const lessons = new Map<string, Lesson | undefined>();
  const lessonById = (lessonId: string) => {
    if (!lessons.has(lessonId)) lessons.set(lessonId, loadLesson(lessonId, contentDir));
    return lessons.get(lessonId);
  };
  const grammarHref = (lesson: Lesson, pageIndex: number) => lessonPageHref(lesson, "grammatica", pageIndex + 1);

  const hrefFor = ({ unit, grammar_page: page }: ErrorTagEntry): string | null => {
    const pageLessonId = page ? lessonIdOfGrammarPage(page) : undefined;
    const pageLesson = pageLessonId ? lessonById(pageLessonId) : undefined;
    const pageIndex = pageLesson?.grammar.findIndex((grammarPage) => grammarPage.id === page) ?? -1;
    if (pageLesson && pageIndex >= 0) return grammarHref(pageLesson, pageIndex);

    const firstLessonId = unit ? units.get(unit)?.lessons[0] : undefined;
    const firstLesson = firstLessonId ? lessonById(firstLessonId) : undefined;
    return firstLesson && firstLesson.grammar.length > 0 ? grammarHref(firstLesson, 0) : null;
  };

  return Object.entries(tags).map(([id, tag]) => ({ id, ...tag, href: hrefFor(tag) }));
}
