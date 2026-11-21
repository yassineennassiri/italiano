import { describe, expect, it } from "vitest";
import { loadLesson } from "./load";
import { hasPage, lessonMenu, resumeHref, reviewNav, reviewPages, reviewStartHref, stepPage } from "./lesson-nav";
import { copyContent, editJson, LESSON_FILE } from "./test-content";

const lesson = () => loadLesson("a2.u01.l01")!;

describe("lessonMenu", () => {
  it("lists every page the example lesson has, then the course overview", () => {
    expect(lessonMenu(lesson()).map((entry) => [entry.page, entry.href])).toEqual([
      ["info", "/a2/benvenuto-a-genova/info"],
      ["esercizi", "/a2/benvenuto-a-genova/esercizi/1"],
      ["grammatica", "/a2/benvenuto-a-genova/grammatica/1"],
      ["vocabolario", "/a2/benvenuto-a-genova/vocabolario"],
      ["cultura", "/a2/benvenuto-a-genova/cultura"],
      ["copione", "/a2/benvenuto-a-genova/copione"],
      ["corso", "/a2"],
    ]);
  });

  it("hides Grammatica, Vocabolario and Cultura when the lesson lacks them", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (data) => {
      data.grammar = [];
      data.vocab = [];
      delete data.culture;
    });
    const pages = lessonMenu(loadLesson("a2.u01.l01", dir)!).map((entry) => entry.page);
    expect(pages).toEqual(["info", "esercizi", "copione", "corso"]);
  });
});

describe("stepPage", () => {
  it("numbers the step N / M and sends Avanti to the next step", () => {
    const page = stepPage(lesson(), "2");
    expect(page).toMatchObject({ number: 2, total: 6, nextHref: "/a2/benvenuto-a-genova/esercizi/3" });
    expect(page?.step.title).toBe("il, lo, l' o la?");
  });

  it("sends Avanti on the last step to the Results", () => {
    expect(stepPage(lesson(), "6")?.nextHref).toBe("/a2/benvenuto-a-genova/risultati");
  });

  it("has no page for a step number the lesson doesn't have", () => {
    for (const n of ["0", "7", "-1", "1.5", "01", "due", ""]) expect(stepPage(lesson(), n)).toBeUndefined();
  });
});

describe("hasPage", () => {
  it("knows which pages the example lesson has, numbered pages included", () => {
    expect(hasPage(lesson(), "cultura")).toBe(true);
    expect(hasPage(lesson(), "grammatica", "2")).toBe(true);
    expect(hasPage(lesson(), "grammatica", "3")).toBe(false);
    expect(hasPage(lesson(), "grammatica")).toBe(false);
    expect(hasPage(lesson(), "esercizi", "6")).toBe(true);
  });

  it("has no Cultura or Vocabolario page for a lesson without them", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (data) => {
      data.vocab = [];
      delete data.culture;
    });
    const bare = loadLesson("a2.u01.l01", dir)!;
    expect(hasPage(bare, "cultura")).toBe(false);
    expect(hasPage(bare, "vocabolario")).toBe(false);
  });
});

describe("resumeHref", () => {
  it("reopens the lesson at the last visited step", () => {
    expect(resumeHref(lesson(), "esercizi/3")).toBe("/a2/benvenuto-a-genova/esercizi/3");
  });

  it("opens the intro when nothing was visited or that step no longer exists", () => {
    for (const location of [null, "esercizi/9", "esercizi/x", "cultura", "../../evil"]) {
      expect(resumeHref(lesson(), location)).toBe("/a2/benvenuto-a-genova/info");
    }
  });
});

describe("reviewPages", () => {
  it("lists the review pages the example lesson has, and Continua opens the first", () => {
    expect(reviewPages(lesson())).toEqual(["grammatica", "vocabolario", "cultura"]);
    expect(reviewStartHref(lesson())).toBe("/a2/benvenuto-a-genova/grammatica/1");
  });

  it("leaves out the pages a lesson lacks; with none, Continua goes to the Finish screen", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (data) => {
      data.grammar = [];
      delete data.culture;
    });
    const noGrammar = loadLesson("a2.u01.l01", dir)!;
    expect(reviewPages(noGrammar)).toEqual(["vocabolario"]);
    expect(reviewStartHref(noGrammar)).toBe("/a2/benvenuto-a-genova/vocabolario");

    editJson(dir, LESSON_FILE, (data) => {
      data.vocab = [];
    });
    expect(reviewStartHref(loadLesson("a2.u01.l01", dir)!)).toBe("/a2/benvenuto-a-genova/fine");
  });
});

describe("reviewNav", () => {
  const base = "/a2/benvenuto-a-genova";

  it("chains grammar 1, grammar 2, vocabulary and culture: the first page has only ›, the last only ‹", () => {
    expect(reviewNav(lesson(), "grammatica", 1)).toEqual({ nextHref: `${base}/grammatica/2`, finishes: false });
    expect(reviewNav(lesson(), "grammatica", 2)).toEqual({
      previousHref: `${base}/grammatica/1`,
      nextHref: `${base}/vocabolario`,
      finishes: false,
    });
    expect(reviewNav(lesson(), "vocabolario")).toEqual({
      previousHref: `${base}/grammatica/2`,
      nextHref: `${base}/cultura`,
      finishes: false,
    });
    expect(reviewNav(lesson(), "cultura")).toEqual({ previousHref: `${base}/vocabolario`, nextHref: `${base}/fine`, finishes: true });
  });

  it("ends at vocabulary when the lesson has no culture page", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (data) => {
      delete data.culture;
    });
    expect(reviewNav(loadLesson("a2.u01.l01", dir)!, "vocabolario")).toEqual({
      previousHref: `${base}/grammatica/2`,
      nextHref: `${base}/fine`,
      finishes: true,
    });
  });
});
