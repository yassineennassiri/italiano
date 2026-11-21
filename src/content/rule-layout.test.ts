import { describe, expect, it } from "vitest";
import { loadLesson } from "./load";
import { layoutRule, type RuleBlock } from "./rule-layout";

/** The example lesson's rule: lo straniero ↓ gli stranieri. */
const exampleRule = () => loadLesson("a2.u01.l01")!.grammar[1].blocks.find((block) => block.kind === "rule") as RuleBlock;

describe("layoutRule", () => {
  it("stacks the rows and places each row's segments left to right, without their leading spaces", () => {
    const { segments } = layoutRule(exampleRule());
    expect(segments.map(({ row, text, style }) => [row, text, style])).toEqual([
      [0, "lo", "highlight"],
      [0, "straniero", "plain"],
      [1, "gli", "highlight"],
      [1, "stranieri", "plain"],
    ]);
    const [lo, straniero, gli, stranieri] = segments;
    expect(straniero.x).toBeGreaterThan(lo.x + lo.width);
    expect(stranieri.x).toBeGreaterThan(gli.x + gli.width);
    expect(gli.y).toBeGreaterThan(lo.y);
    expect(lo.x).toBe(gli.x);
  });

  it("draws a down arrow from under the first segment to above the second, in the gap between the rows", () => {
    const { segments, arrows, fontSize } = layoutRule(exampleRule());
    const [lo, , gli] = segments;
    expect(arrows).toHaveLength(1);
    const [arrow] = arrows;
    expect(arrow.x1).toBeGreaterThan(lo.x);
    expect(arrow.x1).toBeLessThan(lo.x + lo.width);
    expect(arrow.x2).toBeGreaterThan(gli.x);
    expect(arrow.x2).toBeLessThan(gli.x + gli.width);
    expect(arrow.y1).toBeGreaterThan(lo.y);
    expect(arrow.y2).toBeLessThan(gli.y - fontSize * 0.7);
    expect(arrow.y2 - arrow.y1).toBeGreaterThan(fontSize);
    expect(arrow.x1).toBe(arrow.x2);
  });

  it("slants a down arrow between words that don't overlap", () => {
    const rule: RuleBlock = {
      kind: "rule",
      rows: [[{ text: "lo" }, { text: " straniero" }], [{ text: "gli" }, { text: " stranieri" }]],
      arrows: [{ from: [0, 0], to: [1, 1], kind: "down" }],
    };
    const { segments, arrows } = layoutRule(rule);
    const [lo, , , stranieri] = segments;
    expect(arrows[0].x1).toBe(lo.x + lo.width / 2);
    expect(arrows[0].x2).toBe(stranieri.x + stranieri.width / 2);
  });

  it("fits every segment inside its width and height", () => {
    const layout = layoutRule(exampleRule());
    for (const segment of layout.segments) {
      expect(segment.x + segment.width).toBeLessThanOrEqual(layout.width);
      expect(segment.y).toBeLessThan(layout.height);
    }
  });

  it("leaves rows without an arrow between them close together", () => {
    const rule: RuleBlock = { kind: "rule", rows: [[{ text: "il treno" }], [{ text: "i treni" }]] };
    const [first, second] = layoutRule(rule).segments;
    expect(second.y - first.y).toBeLessThan(layoutRule(exampleRule()).segments[2].y - layoutRule(exampleRule()).segments[0].y);
  });

  it("draws only down arrows in M1", () => {
    const rule: RuleBlock = {
      kind: "rule",
      rows: [[{ text: "a" }, { text: " b" }], [{ text: "c" }, { text: " d" }]],
      arrows: [
        { from: [0, 0], to: [1, 1], kind: "diagonal" },
        { from: [0, 0], to: [0, 1], kind: "swap" },
      ],
    };
    expect(layoutRule(rule).arrows).toEqual([]);
  });
});
