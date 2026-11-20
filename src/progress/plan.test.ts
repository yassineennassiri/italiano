import { describe, expect, it } from "vitest";
import { exerciseHashes } from "@/content/hash";
import { loadLesson } from "@/content/load";
import { copyContent, editJson, LESSON_FILE } from "@/content/test-content";
import { planExerciseWrite, restoreEntries, type StoredItemRow } from "./plan";

const NOW = new Date("2026-11-20T10:00:00Z");
const I02 = "a2.u01.l01.s01.i02";

/** The example lesson, with item s01.i02 tagged and solvable. */
function taggedLesson() {
  const dir = copyContent();
  editJson(dir, LESSON_FILE, (lesson) => {
    Object.assign(lesson.steps[0].items[1], { error_tags: ["register.lei"], solvable: true });
  });
  const lesson = loadLesson("a2.u01.l01", dir)!;
  return { lesson, hashes: exerciseHashes(lesson) };
}

const pick = (option: number, eventId = "evt-1") =>
  ({ eventId, lessonId: "a2.u01.l01", exerciseId: I02, kind: "pick", option }) as const;

describe("restoreEntries", () => {
  it("restores rows whose content hash still matches, and drops the rest", () => {
    const { lesson, hashes } = taggedLesson();
    const rows: StoredItemRow[] = [
      { itemId: I02, status: "checked_wrong", firstCheckCorrect: false, points: 0, answer: { picks: [2] }, contentHash: hashes.get(I02)! },
      { itemId: "a2.u01.l01.s01.i01", status: "checked_correct", firstCheckCorrect: true, points: 1, answer: { picks: [0] }, contentHash: "stale" },
      { itemId: "a2.u01.l01.s09.i01", status: "solved", firstCheckCorrect: false, points: 0, answer: null, contentHash: "x" },
    ];
    expect(restoreEntries(lesson, hashes, rows)).toEqual(
      new Map([[I02, { state: { status: "checked_wrong", firstCheckCorrect: false, points: 0 }, answer: { picks: [2] } }]]),
    );
  });

  it("ignores a row whose stored answer doesn't fit the item", () => {
    const { lesson, hashes } = taggedLesson();
    const row: StoredItemRow = { itemId: I02, status: "checked_wrong", firstCheckCorrect: false, points: 0, answer: { picks: "x" }, contentHash: hashes.get(I02)! };
    expect(restoreEntries(lesson, hashes, [row]).size).toBe(0);
  });
});

describe("planExerciseWrite", () => {
  it("writes a wrong first Check to item_state, the attempt history and the error log", () => {
    const { lesson, hashes } = taggedLesson();
    const plan = planExerciseWrite({ lesson, hashes, rows: [], progress: undefined, action: pick(2), now: NOW })!;

    expect(plan.itemState).toEqual({
      itemId: I02,
      lessonId: "a2.u01.l01",
      status: "checked_wrong",
      firstCheckCorrect: false,
      points: 0,
      answer: { picks: [2] },
      contentHash: hashes.get(I02),
      updatedAt: NOW,
    });
    expect(plan.attempt).toEqual({
      id: "evt-1",
      itemId: I02,
      lessonId: "a2.u01.l01",
      contentVersion: 1,
      action: "check",
      answer: { picks: [2] },
      result: null,
      correct: false,
    });
    expect(plan.errors).toEqual([
      {
        source: "exercise",
        lessonId: "a2.u01.l01",
        itemId: I02,
        errorTags: ["register.lei"],
        expected: "Bene, ma il treno era in ritardo.",
        given: "Benissimo, il treno era in anticipo.",
      },
    ]);
    expect(plan.progress).toMatchObject({ lessonId: "a2.u01.l01", contentVersion: 1, status: "in_progress", lastPercent: 0, bestPercent: 0, startedAt: NOW });
  });

  it("scores a right first Check: 1 point of the lesson's 7 scorable items is 14%", () => {
    const { lesson, hashes } = taggedLesson();
    const plan = planExerciseWrite({ lesson, hashes, rows: [], progress: undefined, action: pick(0), now: NOW })!;
    expect(plan.itemState).toMatchObject({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
    expect(plan.errors).toEqual([]);
    expect(plan.progress).toMatchObject({ lastPercent: 14, bestPercent: 14 });
  });

  it("logs no error for a wrong retry, only for the first Check", () => {
    const { lesson, hashes } = taggedLesson();
    const rows: StoredItemRow[] = [
      { itemId: I02, status: "checked_wrong", firstCheckCorrect: false, points: 0, answer: { picks: [2] }, contentHash: hashes.get(I02)! },
    ];
    const plan = planExerciseWrite({ lesson, hashes, rows, progress: undefined, action: pick(1), now: NOW })!;
    expect(plan.itemState.answer).toEqual({ picks: [2, 1] });
    expect(plan.errors).toEqual([]);
  });

  it("treats a row for changed content as untouched, so the next Check is the first again", () => {
    const { lesson, hashes } = taggedLesson();
    const rows: StoredItemRow[] = [
      { itemId: I02, status: "checked_correct", firstCheckCorrect: true, points: 1, answer: { picks: [0] }, contentHash: "old-content" },
    ];
    const plan = planExerciseWrite({ lesson, hashes, rows, progress: undefined, action: pick(2), now: NOW })!;
    expect(plan.itemState).toMatchObject({ status: "checked_wrong", firstCheckCorrect: false, answer: { picks: [2] } });
    expect(plan.errors).toHaveLength(1);
  });

  it("records Solve as an attempt without a verdict", () => {
    const { lesson, hashes } = taggedLesson();
    const action = { eventId: "evt-2", lessonId: "a2.u01.l01", exerciseId: I02, kind: "solve" } as const;
    const plan = planExerciseWrite({ lesson, hashes, rows: [], progress: undefined, action, now: NOW })!;
    expect(plan.itemState).toMatchObject({ status: "solved", points: 0 });
    expect(plan.attempt).toMatchObject({ action: "solve", correct: null });
    expect(plan.errors).toEqual([]);
  });

  it("keeps a completed lesson completed, its start time, and its best %", () => {
    const { lesson, hashes } = taggedLesson();
    const startedAt = new Date("2026-11-01T09:00:00Z");
    const progress = { status: "completed" as const, startedAt, bestPercent: 86 };
    const plan = planExerciseWrite({ lesson, hashes, rows: [], progress, action: pick(0), now: NOW })!;
    expect(plan.progress).toMatchObject({ status: "completed", startedAt, lastPercent: 14, bestPercent: 86 });
  });

  it("plans nothing for an action that changes nothing or names no exercise", () => {
    const { lesson, hashes } = taggedLesson();
    const rows: StoredItemRow[] = [
      { itemId: I02, status: "checked_correct", firstCheckCorrect: true, points: 1, answer: { picks: [0] }, contentHash: hashes.get(I02)! },
    ];
    expect(planExerciseWrite({ lesson, hashes, rows, progress: undefined, action: pick(1), now: NOW })).toBeUndefined();
    const unknown = { ...pick(0), exerciseId: "a2.u01.l01.s09.i01" };
    expect(planExerciseWrite({ lesson, hashes, rows: [], progress: undefined, action: unknown, now: NOW })).toBeUndefined();
  });
});
