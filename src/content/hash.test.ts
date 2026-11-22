import { describe, expect, it } from "vitest";
import { exerciseHashes } from "./hash";
import { readContentFile } from "./files";
import { loadLesson } from "./load";
import { lessonSchema } from "./schema";
import { copyContent, editJson, LESSON_FILE } from "./test-content";

const hashesOf = (dir?: string) => exerciseHashes(loadLesson("a2.u01.l01", dir)!);
/** Hashes of lesson 1 as written in the file, vocab-link markup included (the loader would strip it). */
const rawHashesOf = (dir: string) => exerciseHashes(readContentFile(dir, LESSON_FILE, lessonSchema));

describe("exerciseHashes", () => {
  it("gives every exercise of the lesson a hash, speaking exchanges one each", () => {
    const hashes = hashesOf();
    expect(hashes.size).toBe(11);
    expect(hashes.get("a2.u01.l01.s01.i01")).toMatch(/^[0-9a-f]{16}$/);
    expect(hashes.has("a2.u01.l01.s05.i01.e1")).toBe(true);
  });

  it("changes only the hash of the item whose content changed", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[0].items[1].options[2] = "Benissimo, anzi in anticipo.";
    });
    const before = hashesOf();
    const after = hashesOf(dir);
    expect(after.get("a2.u01.l01.s01.i02")).not.toBe(before.get("a2.u01.l01.s01.i02"));
    for (const [id, hash] of before) if (id !== "a2.u01.l01.s01.i02") expect(after.get(id)).toBe(hash);
  });

  it("ignores edits to notes, which explain the item but don't change it", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[1].items[0].notes[0].text_en = "Reworded note.";
    });
    expect(hashesOf(dir)).toEqual(hashesOf());
  });

  it("hashes a vocab link as its plain word, so adding links keeps progress (ADR-0006)", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[0].items[0].prompt = "Prima di guardare: secondo te, chi aspetta Adam alla [[stazione|v-stazione]]?";
      lesson.steps[1].items[0].text = "{{g1}} [[valigia|v-valigia]], {{g2}} [[zaino|v-zaino]], {{g3}} ombrello e {{g4}} computer.";
      lesson.steps[4].items[0].exchanges[1].other = "Com'è andato il [[viaggio|v-viaggio]]?";
    });
    expect(rawHashesOf(dir)).toEqual(hashesOf());
  });

  it("still changes the hash when the linked word itself changes", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[1].items[0].text = "{{g1}} [[valigie|v-valigia]], {{g2}} zaino, {{g3}} ombrello e {{g4}} computer.";
    });
    expect(rawHashesOf(dir).get("a2.u01.l01.s02.i01")).not.toBe(hashesOf().get("a2.u01.l01.s02.i01"));
  });

  it("keeps lesson 1's hashes as they were when its progress was stored", () => {
    // Recorded before vocab links existed; a change here resets stored progress.
    expect(Object.fromEntries(hashesOf())).toEqual({
      "a2.u01.l01.s01.i01": "5bfa22e1a62a6010",
      "a2.u01.l01.s01.i02": "6c35bbc5992b9282",
      "a2.u01.l01.s01.i03": "5e26ec4e49f656b5",
      "a2.u01.l01.s02.i01": "23ff92cca484f167",
      "a2.u01.l01.s03.i01": "5bd01b83f7beabe2",
      "a2.u01.l01.s04.i01": "d8118a967b3371eb",
      "a2.u01.l01.s04.i02": "364501b964f40b1f",
      "a2.u01.l01.s05.i01.e1": "a7a51f8c36781ebe",
      "a2.u01.l01.s05.i01.e2": "48a5e74f37250173",
      "a2.u01.l01.s05.i01.e3": "4b2c3122e2c28fe5",
      "a2.u01.l01.s06.i01": "8c3a47130d6469e0",
    });
  });
});
