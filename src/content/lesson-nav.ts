/**
 * Where a lesson's pages live and how they link (SPEC §3, §4). Pure: it reads
 * a loaded lesson and returns URLs, so the pages and the menu agree.
 */
import { parseLessonId } from "./ids";
import type { Lesson } from "./schema";

/** The pages of the lesson menu (SPEC §3.1), in order. */
export type LessonPage = "info" | "esercizi" | "grammatica" | "vocabolario" | "cultura" | "copione" | "corso";

export type MenuEntry = { page: LessonPage; href: string };

type LessonRef = Pick<Lesson, "id" | "slug">;

/** `/a2` for any a2 lesson. */
export function levelPath(lesson: Pick<Lesson, "id">): string {
  return `/${parseLessonId(lesson.id)!.level}`;
}

/** `/a2/benvenuto-a-genova`, the base of every page of the lesson. */
export function lessonPath(lesson: LessonRef): string {
  return `${levelPath(lesson)}/${lesson.slug}`;
}

/**
 * The lesson menu's entries. Grammatica, Vocabolario and Cultura are hidden
 * when the lesson has none. Azzera gli esercizi and Altri strumenti join later.
 */
export function lessonMenu(lesson: Lesson): MenuEntry[] {
  const base = lessonPath(lesson);
  const entries: (MenuEntry | false)[] = [
    { page: "info", href: `${base}/info` },
    { page: "esercizi", href: `${base}/esercizi/1` },
    lesson.grammar.length > 0 && { page: "grammatica", href: `${base}/grammatica/1` },
    lesson.vocab.length > 0 && { page: "vocabolario", href: `${base}/vocabolario` },
    lesson.culture !== undefined && { page: "cultura", href: `${base}/cultura` },
    { page: "copione", href: `${base}/copione` },
    { page: "corso", href: levelPath(lesson) },
  ];
  return entries.filter((entry) => entry !== false);
}

export type StepPage<S> = {
  step: S;
  /** 1-based, as in the URL and the "N / M" counter. */
  number: number;
  total: number;
  /** Where Avanti goes: the next step, or the Results after the last one. */
  nextHref: string;
};

/** Parses a 1-based page number from a URL segment: "3" → 3; "03", "0", "x" → undefined. */
export function pageNumber(segment: string, count: number): number | undefined {
  if (!/^[1-9]\d*$/.test(segment)) return undefined;
  const number = Number(segment);
  return number <= count ? number : undefined;
}

/** The step at `/esercizi/:n`, or undefined when the lesson has no step n. */
export function stepPage<S>(lesson: LessonRef & { steps: readonly S[] }, segment: string): StepPage<S> | undefined {
  const total = lesson.steps.length;
  const number = pageNumber(segment, total);
  if (number === undefined) return undefined;
  const base = lessonPath(lesson);
  return {
    step: lesson.steps[number - 1],
    number,
    total,
    nextHref: number < total ? `${base}/esercizi/${number + 1}` : `${base}/risultati`,
  };
}
