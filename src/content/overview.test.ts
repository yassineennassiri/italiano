import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { continueHref, finishTarget, homeLevels, levelOverview } from "./overview";
import { copyContent, editJson, LESSON_FILE } from "./test-content";

describe("homeLevels", () => {
  it("lists the three levels; only a level with lesson files is available", () => {
    expect(homeLevels()).toEqual([
      expect.objectContaining({ id: "a2", title: "Ripasso A2", available: true, href: "/a2" }),
      expect.objectContaining({ id: "b1", title: "B1", available: false }),
      expect.objectContaining({ id: "b2", title: "B2", available: false }),
    ]);
    expect(homeLevels()[0].description).toMatch(/^Le prime settimane/);
  });
});

describe("levelOverview", () => {
  it("lists all ten Ripasso A2 units, unit 1 with its real lesson cards", () => {
    const overview = levelOverview("a2");

    expect(overview?.title).toBe("Ripasso A2");
    expect(overview?.units.map((unit) => unit.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(overview?.units[0]).toMatchObject({
      number: 1,
      title: "Arrivo a Genova",
      lessons: [
        {
          id: "a2.u01.l01",
          title: "Benvenuto a Genova!",
          topic: "Arrivare a Genova e salutare",
          grammarLabel: "Articoli: il, lo, l', la · i, gli, le",
          draft: false,
          href: "/a2/benvenuto-a-genova",
        },
        {
          id: "a2.u01.l02",
          title: "La casa della signora Pina",
          topic: "Visitare la casa nuova",
          grammarLabel: "Articoli: un, uno, una, un' · genere difficile",
          draft: true,
          href: "/a2/la-casa-della-signora-pina",
        },
      ],
    });
  });

  it("gives a unit with no lesson files an empty lesson list, for its In arrivo card", () => {
    const unit2 = levelOverview("a2")?.units[1];
    expect(unit2).toMatchObject({ number: 2, title: "Una casa nei caruggi", lessons: [] });
  });

  it("flags a draft lesson, so its card shows a Bozza badge", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.status = "draft";
    });
    expect(levelOverview("a2", dir)?.units[0].lessons[0].draft).toBe(true);
  });

  it("has no overview for a level the course doesn't have", () => {
    expect(levelOverview("c1")).toBeUndefined();
  });
});

/** A content copy with a second lesson: unit 2's first lesson, a copy of the example under another id and slug. */
function withSecondLesson(): string {
  const dir = copyContent();
  const lesson = JSON.parse(readFileSync(path.join(dir, LESSON_FILE), "utf8"));
  Object.assign(lesson, { id: "a2.u02.l01", slug: "una-casa" });
  const file = path.join(dir, "levels/a2/units/02-una-casa-nei-caruggi/lessons/01-una-casa.json");
  mkdirSync(path.dirname(file), { recursive: true });
  // Every content id inside the lesson starts with the lesson id.
  writeFileSync(file, JSON.stringify(lesson).replaceAll("a2.u01.l01", "a2.u02.l01"));
  editJson(dir, "course.json", (course) => {
    course.levels[0].units[1].lessons = ["a2.u02.l01"];
  });
  return dir;
}

describe("finishTarget", () => {
  it("goes to the next lesson's intro, in the same unit and across units", () => {
    expect(finishTarget("a2.u01.l01")).toEqual({ href: "/a2/la-casa-della-signora-pina/info", levelCompleted: false });
    expect(finishTarget("a2.u01.l02", withSecondLesson())).toEqual({ href: "/a2/una-casa/info", levelCompleted: false });
  });

  it("goes to the level overview with Livello completato after the level's last lesson", () => {
    expect(finishTarget("a2.u01.l02")).toEqual({ href: "/a2?completato=1", levelCompleted: true });
    expect(finishTarget("a2.u02.l01", withSecondLesson())).toEqual({ href: "/a2?completato=1", levelCompleted: true });
  });
});

describe("continueHref (Continua da dove eri)", () => {
  it("opens the first lesson when nothing has been played", () => {
    expect(continueHref([])).toBe("/a2/benvenuto-a-genova");
  });

  it("goes back into the most recently played lesson, completed or not: the lesson route resumes at the last step", () => {
    const recentFirst = [{ lessonId: "a2.u02.l01" }, { lessonId: "a2.u01.l01" }];
    expect(continueHref(recentFirst, withSecondLesson())).toBe("/a2/una-casa");
  });

  it("skips lessons the content no longer has", () => {
    expect(continueHref([{ lessonId: "a2.u09.l09" }])).toBe("/a2/benvenuto-a-genova");
  });
});
