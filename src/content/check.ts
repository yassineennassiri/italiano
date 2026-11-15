/**
 * `content:check`: validates every content file and the links between them.
 * Returns a list of human-readable problems; an empty list means all good.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import type { z } from "zod";
import { findLessonFiles, formatPath, parse, readJson } from "./files";
import { lessonFileHint, lessonFilePattern, lessonIdOfGrammarPage, parseLessonId } from "./ids";
import { errorTagRefs, mediaRefs } from "./refs";
import { type Course, courseSchema, type ErrorTags, errorTagsSchema, type Lesson, lessonSchema } from "./schema";

/** course.json lists every lesson file, each under its own unit, and vice versa. */
function checkCourseMatchesFiles(
  course: Course,
  lessons: Map<string, LessonFile>,
  fileIds: Set<string>,
  problems: string[],
) {
  const listedUnder = new Map<string, string>();
  course.levels.forEach((level, l) =>
    level.units.forEach((unit, u) =>
      unit.lessons.forEach((lessonId, i) => {
        const where = `course.json: levels[${l}].units[${u}].lessons[${i}]`;
        if (listedUnder.has(lessonId)) problems.push(`${where}: lesson "${lessonId}" is listed twice`);
        listedUnder.set(lessonId, unit.id);
        if (!fileIds.has(lessonId)) problems.push(`${where}: no lesson file for "${lessonId}"`);
      }),
    ),
  );

  for (const [lessonId, { file }] of lessons) {
    // The schema guarantees lesson ids parse.
    const { unitId } = parseLessonId(lessonId)!;
    if (listedUnder.get(lessonId) !== unitId) {
      problems.push(`${file}: lesson "${lessonId}" is not listed in course.json under unit "${unitId}"`);
    }
  }
}

type LessonFile = { file: string; lesson: Lesson };

function checkMediaExists(contentDir: string, lessons: Map<string, LessonFile>, problems: string[]) {
  for (const { file, lesson } of lessons.values()) {
    for (const ref of mediaRefs(lesson)) {
      if (!existsSync(path.join(contentDir, "media", ref.value))) {
        problems.push(
          `${file}: ${formatPath(ref.path)}: media file "${ref.value}" does not exist under content/media`,
        );
      }
    }
  }
}

function checkErrorTags(
  tags: ErrorTags,
  course: Course | undefined,
  lessons: Map<string, LessonFile>,
  problems: string[],
) {
  if (course) {
    const unitIds = new Set(course.levels.flatMap((level) => level.units.map((unit) => unit.id)));
    for (const [tag, { unit }] of Object.entries(tags)) {
      if (unit && !unitIds.has(unit)) problems.push(`error-tags.json: ${tag}.unit: no unit "${unit}" in course.json`);
    }
  }
  for (const [tag, { unit, grammar_page: page }] of Object.entries(tags)) {
    if (!page) continue;
    const where = `error-tags.json: ${tag}.grammar_page`;
    const lessonId = lessonIdOfGrammarPage(page);
    if (!unit || !lessonId || parseLessonId(lessonId)?.unitId !== unit) {
      problems.push(`${where}: "${page}" is not in unit "${unit ?? "(none)"}"`);
      continue;
    }
    // A page in a lesson that isn't written yet is fine; a missing page in a written one isn't.
    const lesson = lessons.get(lessonId)?.lesson;
    if (lesson && !lesson.grammar.some((grammarPage) => grammarPage.id === page)) {
      problems.push(`${where}: no grammar page "${page}" in lesson "${lessonId}"`);
    }
  }
  for (const { file, lesson } of lessons.values()) {
    for (const ref of errorTagRefs(lesson)) {
      if (!(ref.value in tags)) problems.push(`${file}: ${formatPath(ref.path)}: unknown error tag "${ref.value}"`);
    }
  }
}

export function checkContent(contentDir: string): string[] {
  const problems: string[] = [];
  const readAndParse = <T>(file: string, schema: z.ZodType<T>) =>
    parse(file, readJson(contentDir, file, problems), schema, problems);
  const course = readAndParse("course.json", courseSchema);
  const errorTags = readAndParse("error-tags.json", errorTagsSchema);

  const lessons = new Map<string, LessonFile>();
  const slugs = new Map<string, string>();
  /** Ids of every lesson file, valid or not, so a broken file isn't also "missing". */
  const fileIds = new Set<string>();
  for (const file of findLessonFiles(contentDir)) {
    const raw = readJson(contentDir, file, problems);
    const rawId = (raw as { id?: unknown } | undefined)?.id;
    if (typeof rawId === "string") fileIds.add(rawId);
    const lesson = parse(file, raw, lessonSchema, problems);
    if (!lesson) continue;
    const previous = lessons.get(lesson.id);
    if (previous) {
      problems.push(`${file}: lesson id "${lesson.id}" is already used by ${previous.file}`);
      continue;
    }
    lessons.set(lesson.id, { file, lesson });

    const lessonId = parseLessonId(lesson.id)!;
    const levelSlug = `${lessonId.level}/${lesson.slug}`;
    const slugOwner = slugs.get(levelSlug);
    if (slugOwner) problems.push(`${file}: slug "${lesson.slug}" is already used by lesson "${slugOwner}"`);
    slugs.set(levelSlug, lesson.id);

    if (!lessonFilePattern(lessonId, lesson.slug).test(file)) {
      problems.push(
        `${file}: lesson "${lesson.id}" with slug "${lesson.slug}" must live at ${lessonFileHint(lessonId, lesson.slug)}`,
      );
    }
  }

  if (course) checkCourseMatchesFiles(course, lessons, fileIds, problems);
  if (errorTags) checkErrorTags(errorTags, course, lessons, problems);
  checkMediaExists(contentDir, lessons, problems);
  return problems;
}
