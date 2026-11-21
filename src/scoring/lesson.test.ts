import { describe, expect, it } from "vitest";
import { loadCourse, loadLesson } from "@/content/load";
import { checkGaps } from "./compare";
import { applyEvents, type ExerciseEvent, type ExerciseState } from "./exercise";
import {
  bestPercent,
  lessonExercises,
  lessonProgress,
  type LessonShape,
  type LessonStatus,
  lessonStatus,
  levelPercent,
  levelStatus,
} from "./lesson";

const example = loadLesson("a2.u01.l01")!;

describe("lessonExercises", () => {
  it("counts each checkable item, each speaking exchange and each Parla! as one exercise", () => {
    // A2.1.1: s01 3 items, s02–s03 1 each, s04 2, s05 one speak_rate with 3 exchanges, s06 Parla!
    const exercises = lessonExercises(example);
    expect(exercises).toHaveLength(11);
    expect(exercises.filter((exercise) => exercise.scorable)).toHaveLength(7);
    expect(exercises.slice(7)).toEqual([
      { id: "a2.u01.l01.s05.i01.e1", stepId: "a2.u01.l01.s05", scorable: false },
      { id: "a2.u01.l01.s05.i01.e2", stepId: "a2.u01.l01.s05", scorable: false },
      { id: "a2.u01.l01.s05.i01.e3", stepId: "a2.u01.l01.s05", scorable: false },
      { id: "a2.u01.l01.s06.i01", stepId: "a2.u01.l01.s06", scorable: false },
    ]);
    expect(exercises[0]).toEqual({ id: "a2.u01.l01.s01.i01", stepId: "a2.u01.l01.s01", scorable: true });
  });
});

/** Two checkable items, a speaking item with two exchanges, and Parla! */
const small: LessonShape = {
  steps: [
    { id: "x.s01", items: [{ id: "x.s01.i01", type: "text_gap" }, { id: "x.s01.i02", type: "single_choice" }] },
    { id: "x.s02", items: [{ id: "x.s02.i01", type: "speak_rate", exchanges: [{ id: "e1" }, { id: "e2" }] }] },
    { id: "x.s03", items: [{ id: "x.s03.i01", type: "parla" }] },
  ],
};

function states(events: Record<string, ExerciseEvent[]>): Map<string, ExerciseState> {
  return new Map(Object.entries(events).map(([id, list]) => [id, applyEvents(list)]));
}

const bene: ExerciseEvent[] = [{ type: "rate", rating: "good" }];

describe("lessonProgress", () => {
  it("starts at 0 of all exercises, 0 points, 0% and 0 steps", () => {
    expect(lessonProgress(small, new Map())).toEqual({
      completed: 0,
      total: 5,
      points: 0,
      scorableItems: 2,
      percent: 0,
      completedSteps: 0,
      totalSteps: 3,
    });
  });

  it("counts self-rated exercises as completed but leaves them out of the % denominator", () => {
    const progress = lessonProgress(
      small,
      states({
        "x.s01.i01": [{ type: "check", correct: true }],
        "x.s02.i01.e1": bene,
        "x.s02.i01.e2": bene,
        "x.s03.i01": bene,
      }),
    );
    // 4 of 5 exercises completed, but the % is 1 point of 2 scorable items, not of 5.
    expect(progress).toMatchObject({ completed: 4, total: 5, points: 1, scorableItems: 2, percent: 50 });
  });

  it("scores an accent-only miss 0, like any wrong answer", () => {
    const result = checkGaps([{ id: "g1", answer: "è" }], { g1: "e" });
    expect(result.gaps.g1).toBe("accent_only");
    const progress = lessonProgress(
      small,
      states({
        "x.s01.i01": [{ type: "check", correct: result.correct }],
        "x.s01.i02": [{ type: "check", correct: true }],
      }),
    );
    expect(progress).toMatchObject({ completed: 2, points: 1, percent: 50 });
  });

  it("gives no points for solved items or correct retries", () => {
    const progress = lessonProgress(
      small,
      states({
        "x.s01.i01": [{ type: "solve" }],
        "x.s01.i02": [{ type: "check", correct: false }, { type: "check", correct: true }],
      }),
    );
    expect(progress).toMatchObject({ completed: 2, points: 0, percent: 0, completedSteps: 1 });
  });

  it("completes a step only when every exercise in it is completed, right or wrong", () => {
    const halfSpoken = states({ "x.s01.i01": [{ type: "check", correct: false }], "x.s02.i01.e1": bene });
    expect(lessonProgress(small, halfSpoken)).toMatchObject({ completedSteps: 0, totalSteps: 3 });
    const allTouched = states({
      "x.s01.i01": [{ type: "check", correct: false }],
      "x.s01.i02": [{ type: "solve" }],
      "x.s02.i01.e1": bene,
      "x.s02.i01.e2": [{ type: "rate", rating: "not_great" }],
    });
    expect(lessonProgress(small, allTouched)).toMatchObject({ completedSteps: 2, totalSteps: 3 });
  });

  it.each([
    [1, 8, 13], // 12.5 rounds up
    [5, 8, 63], // 62.5 rounds up
    [1, 3, 33], // 33.3 rounds down
    [2, 3, 67], // 66.7 rounds up
    [8, 8, 100],
  ])("rounds %i of %i scorable items half up to %i percent", (points, scorable, percent) => {
    const lesson: LessonShape = {
      steps: [
        {
          id: "y.s01",
          items: Array.from({ length: scorable }, (_, i) => ({ id: `y.s01.i${i}`, type: "text_gap" as const })),
        },
        { id: "y.s02", items: [{ id: "y.s02.i01", type: "parla" }] },
      ],
    };
    const right = Object.fromEntries(
      Array.from({ length: points }, (_, i): [string, ExerciseEvent[]] => [`y.s01.i${i}`, [{ type: "check", correct: true }]]),
    );
    expect(lessonProgress(lesson, states({ ...right, "y.s02.i01": bene })).percent).toBe(percent);
  });

  it("works on the example lesson: all 11 exercises, 7 of them scorable", () => {
    expect(lessonProgress(example, new Map())).toMatchObject({ total: 11, scorableItems: 7, totalSteps: 6, percent: 0 });
  });
});

describe("levelPercent", () => {
  const units = [
    { planned_lessons: 3, lessons: ["a2.u01.l01", "a2.u01.l02"] },
    { planned_lessons: 5, lessons: [] },
  ];

  it("divides completed lessons by all planned lessons, written or not", () => {
    // 1 of 8 planned = 12.5% → 13; not 1 of the 2 written = 50%.
    expect(levelPercent({ units }, new Set(["a2.u01.l01"]))).toBe(13);
    expect(levelPercent({ units }, new Set())).toBe(0);
  });

  it("ignores completed lessons from other levels", () => {
    expect(levelPercent({ units }, new Set(["b1.u01.l01", "a2.u01.l02"]))).toBe(13);
  });

  it("uses the 30 planned lessons of Ripasso A2", () => {
    const a2 = loadCourse().levels.find((level) => level.id === "a2")!;
    expect(levelPercent(a2, new Set(["a2.u01.l01"]))).toBe(3); // 3.33
  });
});

describe("lessonStatus", () => {
  it("is not_started while nothing is touched, in_progress after any exercise, completed once Finish is reached", () => {
    expect(lessonStatus(lessonProgress(small, new Map()), false)).toBe("not_started");
    expect(lessonStatus(lessonProgress(small, states({ "x.s03.i01": bene })), false)).toBe("in_progress");
    expect(lessonStatus(lessonProgress(small, states({ "x.s03.i01": bene })), true)).toBe("completed");
  });
});

describe("bestPercent", () => {
  it("keeps the highest % so far and starts from the first one", () => {
    expect(bestPercent(null, 40)).toBe(40);
    expect(bestPercent(80, 40)).toBe(80);
    expect(bestPercent(40, 80)).toBe(80);
  });
});

describe("levelStatus", () => {
  const level = {
    units: [
      { planned_lessons: 2, lessons: ["a2.u01.l01", "a2.u01.l02"] },
      { planned_lessons: 1, lessons: [] },
    ],
  };
  const statuses = (entries: Record<string, LessonStatus>) => new Map(Object.entries(entries));

  it("is not_started until one of its lessons is started, and ignores other levels", () => {
    expect(levelStatus(level, statuses({}))).toBe("not_started");
    expect(levelStatus(level, statuses({ "a2.u01.l01": "not_started", "b1.u01.l01": "completed" }))).toBe("not_started");
  });

  it("is in_progress while some planned lessons are not completed, even when every written one is", () => {
    expect(levelStatus(level, statuses({ "a2.u01.l01": "in_progress" }))).toBe("in_progress");
    expect(levelStatus(level, statuses({ "a2.u01.l01": "completed", "a2.u01.l02": "completed" }))).toBe("in_progress");
  });

  it("is completed when every planned lesson is written and completed", () => {
    const written = { units: [{ planned_lessons: 2, lessons: ["a2.u01.l01", "a2.u01.l02"] }] };
    expect(levelStatus(written, statuses({ "a2.u01.l01": "completed", "a2.u01.l02": "completed" }))).toBe("completed");
  });
});
