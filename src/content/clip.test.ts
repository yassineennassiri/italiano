import { describe, expect, it } from "vitest";
import { clipLines } from "./clip";
import { loadLesson } from "./load";

const scene = loadLesson("a2.u01.l02")!.scene;

describe("clipLines", () => {
  it("picks the scene lines from from_line to to_line, in scene order", () => {
    expect(clipLines(scene, { from_line: "L11", to_line: "L13" }).map((line) => line.it)).toEqual([
      "Che bello! Ma c'è un problema: in cucina la luce non funziona.",
      "Ah, sì, il problema della luce… Domani chiamo un elettricista.",
      "Non serve, signora: sono un ingegnere elettrico!",
    ]);
  });

  it("picks a single line when the clip starts and ends on it", () => {
    expect(clipLines(scene, { from_line: "L4", to_line: "L4" }).map((line) => line.id)).toEqual(["L4"]);
  });

  it("picks the whole scene from its first line to its last", () => {
    expect(clipLines(scene, { from_line: "L1", to_line: "L14" })).toHaveLength(14);
  });

  it("refuses a clip whose lines aren't in the scene, or that runs backwards", () => {
    expect(() => clipLines(scene, { from_line: "L2", to_line: "L99" })).toThrow(/L99/);
    expect(() => clipLines(scene, { from_line: "L5", to_line: "L3" })).toThrow(/backwards/);
  });
});
