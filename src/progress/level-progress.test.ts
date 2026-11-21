import { describe, expect, it } from "vitest";
import { levelProgress } from "./level-progress";

describe("levelProgress", () => {
  it("shows a completed lesson with its best %, and the level % over Ripasso A2's 30 planned lessons", () => {
    const progress = levelProgress("a2", [{ lessonId: "a2.u01.l01", status: "completed", bestPercent: 87 }]);
    expect(progress).toEqual({
      percent: 3,
      status: "in_progress",
      lessons: new Map([["a2.u01.l01", { status: "completed", bestPercent: 87 }]]),
    });
  });

  it("shows no % for a lesson that was only visited", () => {
    const progress = levelProgress("a2", [{ lessonId: "a2.u01.l01", status: "not_started", bestPercent: null }]);
    expect(progress).toMatchObject({ percent: 0, status: "not_started" });
    expect(progress?.lessons.get("a2.u01.l01")).toEqual({ status: "not_started" });
  });

  it("has no progress for a level the course doesn't have", () => {
    expect(levelProgress("c1", [])).toBeUndefined();
  });
});
