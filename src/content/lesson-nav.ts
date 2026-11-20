/**
 * Where a lesson's pages live and which ones it has (SPEC §3, §4). Pure: it
 * reads a loaded lesson and returns URLs, so the pages and the menu agree.
 */
import { parseLessonId } from "./ids";
import type { Lesson } from "./schema";

/** The pages of the lesson menu (SPEC §3.1), in order. */
export type LessonPage = "info" | "esercizi" | "grammatica" | "vocabolario" | "cultura" | "copione" | "corso";

/** Pages a lesson may lack: numbered ones (one per step or grammar page) and optional ones. */
export type ContentPage = "esercizi" | "grammatica" | "vocabolario" | "cultura";

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

/** A page of the lesson: `lessonPageHref(lesson, "esercizi", 3)` → `/a2/benvenuto-a-genova/esercizi/3`. */
export function lessonPageHref(
  lesson: LessonRef,
  page: Exclude<LessonPage, "corso"> | "risultati" | "fine",
  number?: number,
): string {
  return `${lessonPath(lesson)}/${page}${number === undefined ? "" : `/${number}`}`;
}

/** Parses a 1-based page number from a URL segment: "3" → 3; "03", "0", "x" → undefined. */
export function pageNumber(segment: string, count: number): number | undefined {
  if (!/^[1-9]\d*$/.test(segment)) return undefined;
  const number = Number(segment);
  return number <= count ? number : undefined;
}

type PagedLesson = Pick<Lesson, "steps" | "grammar" | "vocab" | "culture">;

/** Whether the lesson has this page; numbered pages need the URL segment ("2" for grammatica/2). */
export function hasPage(lesson: PagedLesson, page: ContentPage, segment?: string): boolean {
  switch (page) {
    case "esercizi":
      return segment !== undefined && pageNumber(segment, lesson.steps.length) !== undefined;
    case "grammatica":
      return segment !== undefined && pageNumber(segment, lesson.grammar.length) !== undefined;
    case "vocabolario":
      return lesson.vocab.length > 0;
    case "cultura":
      return lesson.culture !== undefined;
  }
}

/**
 * The lesson menu's entries. Grammatica, Vocabolario and Cultura are hidden
 * when the lesson has none. Azzera gli esercizi and Altri strumenti join later.
 */
export function lessonMenu(lesson: Lesson): MenuEntry[] {
  const entries: (MenuEntry | false)[] = [
    { page: "info", href: lessonPageHref(lesson, "info") },
    { page: "esercizi", href: lessonPageHref(lesson, "esercizi", 1) },
    hasPage(lesson, "grammatica", "1") && { page: "grammatica", href: lessonPageHref(lesson, "grammatica", 1) },
    hasPage(lesson, "vocabolario") && { page: "vocabolario", href: lessonPageHref(lesson, "vocabolario") },
    hasPage(lesson, "cultura") && { page: "cultura", href: lessonPageHref(lesson, "cultura") },
    { page: "copione", href: lessonPageHref(lesson, "copione") },
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

/** The step at `/esercizi/:n`, or undefined when the lesson has no step n. */
export function stepPage<S>(lesson: LessonRef & { steps: readonly S[] }, segment: string): StepPage<S> | undefined {
  const total = lesson.steps.length;
  const number = pageNumber(segment, total);
  if (number === undefined) return undefined;
  return {
    step: lesson.steps[number - 1],
    number,
    total,
    nextHref: number < total ? lessonPageHref(lesson, "esercizi", number + 1) : lessonPageHref(lesson, "risultati"),
  };
}

/** `esercizi/3`: what `lesson_progress.last_location` stores for a step page. */
export function stepLocation(number: number): string {
  return `esercizi/${number}`;
}

/**
 * Where reopening the lesson goes (SPEC §3): the last visited step, or the
 * intro when nothing was visited or that step no longer exists.
 */
export function resumeHref(lesson: LessonRef & PagedLesson, lastLocation: string | null): string {
  const segment = /^esercizi\/(\d+)$/.exec(lastLocation ?? "")?.[1];
  return segment !== undefined && hasPage(lesson, "esercizi", segment)
    ? lessonPageHref(lesson, "esercizi", Number(segment))
    : lessonPageHref(lesson, "info");
}
