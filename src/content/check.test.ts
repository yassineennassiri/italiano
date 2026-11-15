import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkContent } from "./check";

const CONTENT_DIR = path.join(process.cwd(), "content");
const LESSON_FILE = "levels/a2/units/01-arrivo-a-genova/lessons/01-benvenuto-a-genova.json";

const copies: string[] = [];

/** A throwaway copy of the real content directory. */
function copyContent(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "italiano-content-"));
  cpSync(CONTENT_DIR, dir, { recursive: true });
  copies.push(dir);
  return dir;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests mutate raw JSON
type Json = any;

function editJson(dir: string, file: string, edit: (data: Json) => void) {
  const full = path.join(dir, file);
  const data = JSON.parse(readFileSync(full, "utf8"));
  edit(data);
  writeFileSync(full, JSON.stringify(data, null, 2));
}

afterEach(() => {
  for (const dir of copies.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("checkContent", () => {
  it("finds no problems in the real content", () => {
    expect(checkContent(CONTENT_DIR)).toEqual([]);
  });

  it("reports a gap marker that has no gap entry", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      // steps[1] is the dropdown "{{g1}} valigia, … {{g4}} computer."
      lesson.steps[1].items[0].gaps.pop();
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[1].items[0].text: gap marker {{g4}} has no gap entry`,
    ]);
  });

  it("reports a choice answer index outside the options", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[0].items[0].answer = 3; // three options: 0..2
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[0].items[0].answer: answer index 3 is out of range (3 options)`,
    ]);
  });

  it("reports multi_select answer indexes outside the options", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[0].items[2].answers = [0, 4]; // four options: 0..3
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[0].items[2].answers[1]: answer index 4 is out of range (4 options)`,
    ]);
  });

  it("reports a dropdown answer that is not one of its options", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[1].items[0].gaps[0].answer = "le";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[1].items[0].gaps[0].answer: answer "le" is not one of the options`,
    ]);
  });

  it("reports a lesson whose last step has no parla item", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps.pop();
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[4]: the last step must contain a parla item`,
    ]);
  });

  it("reports duplicate exchange ids inside a speaking item", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[4].items[0].exchanges[2].id = "e1";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[4].items[0].exchanges[2].id: duplicate exchange id "e1"`,
    ]);
  });

  it("reports a rule arrow that points at a missing segment", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.grammar[1].blocks[1].arrows[0].to = [2, 0]; // the rule has rows 0..1
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: grammar[1].blocks[1].arrows[0].to: no segment [2, 0] in this rule`,
    ]);
  });

  it("reports a scene panel that starts at an unknown line", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.scene.panels[1].from_line = "L99";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: scene.panels[1].from_line: no scene line "L99"`,
    ]);
  });

  it("reports duplicate item and vocab ids", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[0].items[1].id = "a2.u01.l01.s01.i01";
      lesson.vocab[1].id = "v-appartamento";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[0].items[1].id: duplicate item id "a2.u01.l01.s01.i01"`,
      `${LESSON_FILE}: vocab[1].id: duplicate vocab id "v-appartamento"`,
    ]);
  });

  it("reports ids that do not extend their parent's id", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[2].id = "a2.u01.l02.s03";
      lesson.steps[3].items[1].id = "a2.u01.l01.s03.i02";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[2].id: "a2.u01.l02.s03" must look like "a2.u01.l01.sNN"`,
      `${LESSON_FILE}: steps[2].items[0].id: "a2.u01.l01.s03.i01" must look like "a2.u01.l02.s03.iNN"`,
      `${LESSON_FILE}: steps[3].items[1].id: "a2.u01.l01.s03.i02" must look like "a2.u01.l01.s04.iNN"`,
    ]);
  });

  it("reports a lesson listed in course.json that has no file", () => {
    const dir = copyContent();
    editJson(dir, "course.json", (course) => {
      course.levels[0].units[0].lessons.push("a2.u01.l02");
    });
    expect(checkContent(dir)).toEqual([
      `course.json: levels[0].units[0].lessons[1]: no lesson file for "a2.u01.l02"`,
    ]);
  });

  it("reports a lesson file that course.json does not list", () => {
    const dir = copyContent();
    editJson(dir, "course.json", (course) => {
      course.levels[0].units[0].lessons = [];
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: lesson "a2.u01.l01" is not listed in course.json under unit "a2.u01"`,
    ]);
  });

  it("reports a lesson file whose name does not match its id and slug", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.slug = "arrivo";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: lesson "a2.u01.l01" with slug "arrivo" must live at levels/a2/units/01-*/lessons/01-arrivo.json`,
    ]);
  });

  it("reports error tags that error-tags.json does not define", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[1].items[0].error_tags = ["article.elision", "article.elisione"];
      lesson.steps[1].items[0].notes[0].error_tag = "article.apostrophe";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[1].items[0].error_tags[1]: unknown error tag "article.elisione"`,
      `${LESSON_FILE}: steps[1].items[0].notes[0].error_tag: unknown error tag "article.apostrophe"`,
    ]);
  });

  it("reports an error tag linked to a unit that course.json does not have", () => {
    const dir = copyContent();
    editJson(dir, "error-tags.json", (tags) => {
      tags["article.lo"].unit = "a2.u11";
    });
    expect(checkContent(dir)).toEqual([
      `error-tags.json: article.lo.unit: no unit "a2.u11" in course.json`,
    ]);
  });

  it("reports referenced media files that do not exist", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.culture.image = "images/a2/u01/l01/missing.webp";
      lesson.scene.lines[0].audio = "audio/a2/u01/l01/missing.mp3";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: scene.lines[0].audio: media file "audio/a2/u01/l01/missing.mp3" does not exist under content/media`,
      `${LESSON_FILE}: culture.image: media file "images/a2/u01/l01/missing.webp" does not exist under content/media`,
    ]);
  });
});
