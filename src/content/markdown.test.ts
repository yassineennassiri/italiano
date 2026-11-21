import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "./markdown";

describe("parseInline", () => {
  it("marks **bold** and *italic* runs, as in the grammar example sentence", () => {
    expect(parseInline("Sì: **la** valigia, **l'**ombrello e *basta*.")).toEqual([
      { text: "Sì: " },
      { text: "la", bold: true },
      { text: " valigia, " },
      { text: "l'", bold: true },
      { text: "ombrello e " },
      { text: "basta", italic: true },
      { text: "." },
    ]);
  });

  it("keeps a lone asterisk as text", () => {
    expect(parseInline("5 * 3 = 15")).toEqual([{ text: "5 * 3 = 15" }]);
  });
});

describe("parseMarkdown", () => {
  it("splits paragraphs on blank lines and joins the lines inside one", () => {
    expect(parseMarkdown("Many trains arrive at\n**Genova Piazza Principe**.\n\n  The *caruggi* are narrow.  ")).toEqual([
      [{ text: "Many trains arrive at " }, { text: "Genova Piazza Principe", bold: true }, { text: "." }],
      [{ text: "The " }, { text: "caruggi", italic: true }, { text: " are narrow." }],
    ]);
  });
});
