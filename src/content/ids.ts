/**
 * Content IDs are hierarchical (SPEC §9): unit `a2.u01`, lesson `a2.u01.l01`,
 * grammar page `a2.u01.l01.gr2`. This module is the one place that knows how
 * they are built and where a lesson's file lives.
 */

export type LevelId = "a2" | "b1" | "b2";

export type LessonId = {
  level: LevelId;
  /** Two digits, e.g. "01". */
  unitNumber: string;
  /** Two digits, e.g. "01". */
  lessonNumber: string;
  /** e.g. "a2.u01" */
  unitId: string;
};

export const LESSON_ID_PATTERN = /^(a2|b1|b2)\.u(\d{2})\.l(\d{2})$/;

export function parseLessonId(id: string): LessonId | undefined {
  const match = LESSON_ID_PATTERN.exec(id);
  if (!match) return undefined;
  const [, level, unitNumber, lessonNumber] = match;
  return { level: level as LevelId, unitNumber, lessonNumber, unitId: `${level}.u${unitNumber}` };
}

/** `unitId("a2", 3)` → `"a2.u03"` */
export function unitId(level: string, number: number): string {
  return `${level}.u${String(number).padStart(2, "0")}`;
}

/**
 * The exercise id of one speaking exchange (SPEC §10.3): item id + "." +
 * exchange id, e.g. `a2.u01.l01.s05.i01.e2`.
 */
export function exchangeExerciseId(itemId: string, exchangeId: string): string {
  return `${itemId}.${exchangeId}`;
}

/** The lesson an exercise id belongs to: `a2.u01.l01.s05.i01.e2` → `a2.u01.l01`. */
export function lessonIdOfExercise(exerciseId: string): string | undefined {
  const lessonId = /^(.+?\.l\d{2})\.s\d+\./.exec(exerciseId)?.[1];
  return lessonId !== undefined && LESSON_ID_PATTERN.test(lessonId) ? lessonId : undefined;
}

/** The lesson a grammar page id belongs to: `a2.u01.l01.gr2` → `a2.u01.l01`. */
export function lessonIdOfGrammarPage(pageId: string): string | undefined {
  return /^(.+)\.gr\d+$/.exec(pageId)?.[1];
}

/**
 * Where a lesson file lives: `levels/a2/units/01-<unit-name>/lessons/01-<slug>.json`.
 * Without a slug the pattern matches any slug.
 */
export function lessonFilePattern(id: LessonId, slug?: string): RegExp {
  const name = slug ? `${slug}\\.json` : "[^/]+\\.json";
  return new RegExp(`^levels/${id.level}/units/${id.unitNumber}-[^/]+/lessons/${id.lessonNumber}-${name}$`);
}

/** A readable form of `lessonFilePattern`, for error messages. */
export function lessonFileHint(id: LessonId, slug: string): string {
  return `levels/${id.level}/units/${id.unitNumber}-*/lessons/${id.lessonNumber}-${slug}.json`;
}
