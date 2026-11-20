import { describe, expect, it } from "vitest";
import { exerciseHashes } from "./hash";
import { loadLesson } from "./load";
import { copyContent, editJson, LESSON_FILE } from "./test-content";

const hashesOf = (dir?: string) => exerciseHashes(loadLesson("a2.u01.l01", dir)!);

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
});
