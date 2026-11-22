import { describe, expect, it } from "vitest";
import { exerciseHashes } from "@/content/hash";
import { loadLesson } from "@/content/load";
import type { Lesson } from "@/content/schema";
import { DRILL_SIZE, drillExercises } from "./drill";

const L1 = "a2.u01.l01";
const L2 = "a2.u01.l02";
const completed = (...lessonIds: string[]) => lessonIds.map((lessonId) => ({ lessonId, status: "completed" as const }));

/** Lesson 2 with `article.lo` on every item, so the tag has more exercises than a drill holds. */
function taggedEverywhere(): Lesson {
  const lesson = structuredClone(loadLesson(L2)!);
  for (const step of lesson.steps) for (const item of step.items) item.error_tags = [...(item.error_tags ?? []), "article.lo"];
  return lesson;
}

const ids = (exercises: { exerciseId: string }[]) => exercises.map((exercise) => exercise.exerciseId).sort();

describe("drillExercises", () => {
  it("drills the exercises carrying the tag, each speaking exchange on its own, without Parla!", () => {
    const drill = drillExercises({ tag: "article.elision", progress: completed(L1), load: loadLesson, carded: new Set(), random: Math.random });
    expect(ids(drill)).toEqual(
      ["a2.u01.l01.s02.i01", "a2.u01.l01.s04.i02", "a2.u01.l01.s05.i01.e1", "a2.u01.l01.s05.i01.e2", "a2.u01.l01.s05.i01.e3"].sort(),
    );
    const exchange = drill.find((exercise) => exercise.exerciseId === "a2.u01.l01.s05.i01.e2")!;
    expect(exchange.item.type === "speak_rate" && exchange.item.exchanges.map((one) => one.id)).toEqual(["e2"]);
    expect(exchange.contentHash).toBe(exerciseHashes(loadLesson(L1)!).get("a2.u01.l01.s05.i01.e2"));
    expect(exchange.lesson.id).toBe(L1);
    expect(exchange.step.id).toBe("a2.u01.l01.s05");
  });

  it("takes exercises only from completed lessons", () => {
    const progress = [...completed(L1), { lessonId: L2, status: "in_progress" as const }];
    const drill = drillExercises({ tag: "article.lo", progress, load: loadLesson, carded: new Set(), random: Math.random });
    expect(ids(drill)).toEqual(["a2.u01.l01.s02.i01"]);
    expect(drillExercises({ tag: "article.lo", progress: [], load: loadLesson, carded: new Set(), random: Math.random })).toEqual([]);
  });

  it("holds at most 10, preferring exercises that have an item card", () => {
    const lesson = taggedEverywhere();
    const load = (lessonId: string) => (lessonId === L2 ? lesson : loadLesson(lessonId));
    const all = drillExercises({ tag: "article.lo", progress: completed(L1, L2), load, carded: new Set(), random: Math.random });
    expect(all).toHaveLength(DRILL_SIZE);
    expect(new Set(ids(all)).size).toBe(DRILL_SIZE);

    const carded = new Set(["a2.u01.l02.s04.i01", "a2.u01.l02.s06.i01", "a2.u01.l01.s02.i01"]);
    for (let seed = 0; seed < 5; seed++) {
      const drill = drillExercises({ tag: "article.lo", progress: completed(L1, L2), load, carded, random: () => (seed + 0.5) / 5 });
      expect(drill).toHaveLength(DRILL_SIZE);
      for (const id of carded) expect(ids(drill)).toContain(id);
    }
  });

  it("is empty for a tag no completed exercise carries", () => {
    expect(drillExercises({ tag: "speaking", progress: completed(L1, L2), load: loadLesson, carded: new Set(), random: Math.random })).toEqual([]);
  });
});
