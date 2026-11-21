import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { estimateLineSeconds, estimateSceneSeconds, panelIndexAt } from "./scene-timeline";

const scene = loadLesson("a2.u01.l01")!.scene;

describe("estimateLineSeconds", () => {
  it("reads 14 characters a second at 1×, and slower at 0.75×", () => {
    expect(estimateLineSeconds("x".repeat(28))).toBe(2);
    expect(estimateLineSeconds("x".repeat(28), 0.75)).toBeCloseTo(2.667, 3);
  });

  it("gives a short line at least a second", () => {
    expect(estimateLineSeconds("Sì.")).toBe(1);
  });
});

describe("estimateSceneSeconds", () => {
  it("adds the lines with a 0.4 s gap between them", () => {
    const lines = [{ it: "x".repeat(28) }, { it: "x".repeat(42) }, { it: "Sì." }];
    expect(estimateSceneSeconds(lines)).toBeCloseTo(2 + 0.4 + 3 + 0.4 + 1, 6);
  });

  it("stretches the speaking, not the gaps, at 0.75×", () => {
    const lines = [{ it: "x".repeat(42) }, { it: "x".repeat(42) }];
    expect(estimateSceneSeconds(lines, 0.75)).toBeCloseTo(4 + 0.4 + 4, 6);
  });
});

describe("panelIndexAt", () => {
  it("shows each panel from its from_line onward", () => {
    // Panels start at L1, L5 and L8.
    expect([0, 3, 4, 6, 7, 10].map((line) => panelIndexAt(scene, line))).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it("shows the first panel before any from_line", () => {
    expect(panelIndexAt({ lines: scene.lines, panels: [{ image: "a.webp", from_line: "L3" }, { image: "b.webp", from_line: "L5" }] }, 0)).toBe(0);
  });
});
