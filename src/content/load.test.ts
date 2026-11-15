import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadCourse, loadErrorTags, loadLesson, loadLessonBySlug } from "./load";

const LESSON_FILE = "levels/a2/units/01-arrivo-a-genova/lessons/01-benvenuto-a-genova.json";
const copies: string[] = [];

afterEach(() => {
  for (const dir of copies.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("loadCourse", () => {
  it("lists all three levels and the ten Ripasso A2 units, 30 planned lessons in all", () => {
    const course = loadCourse();
    expect(course.levels.map((level) => level.id)).toEqual(["a2", "b1", "b2"]);
    const a2 = course.levels[0];
    expect(a2.units).toHaveLength(10);
    expect(a2.units[1]).toMatchObject({ id: "a2.u02", number: 2, title: "Una casa nei caruggi", lessons: [] });
    expect(a2.units.reduce((sum, unit) => sum + unit.planned_lessons, 0)).toBe(30);
  });
});

describe("loadLesson", () => {
  it("loads a lesson by id", () => {
    const lesson = loadLesson("a2.u01.l01");
    expect(lesson?.title).toBe("Benvenuto a Genova!");
    expect(lesson?.steps).toHaveLength(6);
  });

  it("loads a lesson by level and slug, as the routes address it", () => {
    expect(loadLessonBySlug("a2", "benvenuto-a-genova")?.id).toBe("a2.u01.l01");
    expect(loadLessonBySlug("b1", "benvenuto-a-genova")).toBeUndefined();
  });

  it("returns undefined for a lesson that has no file", () => {
    expect(loadLesson("a2.u02.l01")).toBeUndefined();
  });

  it("refuses an invalid lesson file, saying what is wrong", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "italiano-load-"));
    copies.push(dir);
    cpSync(path.join(process.cwd(), "content"), dir, { recursive: true });
    const file = path.join(dir, LESSON_FILE);
    const lesson = JSON.parse(readFileSync(file, "utf8"));
    lesson.steps[0].items[0].answer = 7;
    writeFileSync(file, JSON.stringify(lesson));

    expect(() => loadLesson("a2.u01.l01", dir)).toThrow(
      `${LESSON_FILE}: steps[0].items[0].answer: answer index 7 is out of range (3 options)`,
    );
  });
});

describe("loadErrorTags", () => {
  it("loads all 14 tags with their English explanations", () => {
    const tags = loadErrorTags();
    expect(tags).toHaveLength(14);
    expect(tags.find((tag) => tag.id === "article.elision")?.explanation_en).toMatch(/l'ombrello/);
  });

  it("links a tag to the first grammar page of its unit's first lesson", () => {
    const tag = loadErrorTags().find((tag) => tag.id === "article.elision");
    expect(tag?.href).toBe("/a2/benvenuto-a-genova/grammatica/1");
  });

  it("gives no link to tags whose unit has no lessons yet, or that have no unit", () => {
    const tags = loadErrorTags();
    expect(tags.find((tag) => tag.id === "partitive.masc_plural")?.href).toBeNull();
    expect(tags.find((tag) => tag.id === "congiuntivo.volere_che")?.href).toBeNull();
    expect(tags.find((tag) => tag.id === "speaking")?.href).toBeNull();
  });
});
