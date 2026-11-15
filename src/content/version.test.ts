import { describe, expect, it } from "vitest";
import { copyContent, editJson, LESSON_FILE } from "./test-content";
import { contentVersion } from "./version";

describe("contentVersion", () => {
  it("is a short fingerprint, the same for identical content on another computer", () => {
    const version = contentVersion();
    expect(version).toMatch(/^[0-9a-f]{7}$/);
    expect(contentVersion(copyContent())).toBe(version);
  });

  it("changes when a lesson file changes, even if its version wasn't bumped", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.topic = "Un altro argomento";
    });
    expect(contentVersion(dir)).not.toBe(contentVersion());
  });

  it("changes when the course plan changes", () => {
    const dir = copyContent();
    editJson(dir, "course.json", (course) => {
      course.levels[0].units[1].planned_lessons = 4;
    });
    expect(contentVersion(dir)).not.toBe(contentVersion());
  });
});
