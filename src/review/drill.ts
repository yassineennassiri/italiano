/**
 * Tag drills (SPEC §10.5): a short run of exercises sharing one error tag,
 * taken from completed lessons and started from the review hub. Pure apart
 * from the lesson loader it is given.
 */
import { exerciseHashes } from "@/content/hash";
import type { Lesson } from "@/content/schema";
import { shuffledIndexes } from "@/items/shuffle";
import type { LessonStatus } from "@/scoring/lesson";
import { lessonExercises } from "@/scoring/lesson";
import { type ShownExercise, shownExercise } from "./session";

/** A drill holds at most this many exercises. */
export const DRILL_SIZE = 10;

/** An exercise as a drill shows it. */
export type DrillExercise = ShownExercise & { kind: "drill" };

const shuffled = <T>(values: readonly T[], random: () => number): T[] => shuffledIndexes(values.length, random).map((index) => values[index]);

/**
 * Up to 10 exercises whose item carries `tag`, from the completed lessons, in
 * random order. Exercises with an item card (`carded`: ones the learner got
 * wrong) come in first, the tag's other exercises fill the rest. Each speaking
 * exchange is one exercise; Parla! is left out, as for item cards.
 */
export function drillExercises({
  tag,
  progress,
  load,
  carded,
  random,
}: {
  tag: string;
  progress: readonly { lessonId: string; status: LessonStatus }[];
  load: (lessonId: string) => Lesson | undefined;
  /** Exercise ids that have an item card. */
  carded: ReadonlySet<string>;
  random: () => number;
}): DrillExercise[] {
  const tagged: DrillExercise[] = [];
  for (const { lessonId, status } of progress) {
    const lesson = status === "completed" ? load(lessonId) : undefined;
    if (!lesson) continue;
    const hashes = exerciseHashes(lesson);
    for (const { id } of lessonExercises(lesson)) {
      const shown = shownExercise(lesson, id, hashes);
      if (shown && shown.item.type !== "parla" && shown.item.error_tags?.includes(tag)) tagged.push({ kind: "drill", ...shown });
    }
  }
  const first = shuffled(tagged.filter((exercise) => carded.has(exercise.exerciseId)), random);
  const rest = shuffled(tagged.filter((exercise) => !carded.has(exercise.exerciseId)), random);
  return shuffled([...first, ...rest].slice(0, DRILL_SIZE), random);
}
