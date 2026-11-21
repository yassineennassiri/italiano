import { describe, expect, it } from "vitest";
import { splitGapText } from "./gap-text";

describe("splitGapText", () => {
  it("splits an item's text into plain text and gaps, in order", () => {
    expect(splitGapText("{{g1}} valigia, {{g2}} zaino e {{g3}} computer.")).toEqual([
      { gap: "g1" },
      { text: " valigia, " },
      { gap: "g2" },
      { text: " zaino e " },
      { gap: "g3" },
      { text: " computer." },
    ]);
  });

  it("keeps line breaks in the text, and leaves out empty pieces", () => {
    expect(splitGapText("A: {{g1}}\nB: sì")).toEqual([{ text: "A: " }, { gap: "g1" }, { text: "\nB: sì" }]);
  });
});
