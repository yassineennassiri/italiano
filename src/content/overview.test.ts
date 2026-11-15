import { describe, expect, it } from "vitest";
import { homeLevels, levelOverview } from "./overview";
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
  it("lists all ten Ripasso A2 units, unit 1 with its real lesson card", () => {
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
