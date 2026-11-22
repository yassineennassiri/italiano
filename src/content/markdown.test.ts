import { describe, expect, it } from "vitest";
import { parseDocument, parseInline, parseMarkdown } from "./markdown";

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

describe("parseDocument", () => {
  it("reads a step reading as a heading, subheads, paragraphs and a list, as in lesson 2's house rules", () => {
    const md = [
      "# Le regole del palazzo",
      "",
      "Benvenuti! Il palazzo è **antico**:\nha cinque piani.",
      "",
      "## Per gli inquilini",
      "",
      "- La chiave apre anche la cantina.",
      "- La lavatrice è *in cucina*.",
      "",
      "Grazie e buona permanenza!",
    ].join("\n");

    expect(parseDocument(md)).toEqual([
      { kind: "heading", spans: [{ text: "Le regole del palazzo" }] },
      { kind: "paragraph", spans: [{ text: "Benvenuti! Il palazzo è " }, { text: "antico", bold: true }, { text: ": ha cinque piani." }] },
      { kind: "subhead", spans: [{ text: "Per gli inquilini" }] },
      {
        kind: "list",
        items: [[{ text: "La chiave apre anche la cantina." }], [{ text: "La lavatrice è " }, { text: "in cucina", italic: true }, { text: "." }]],
      },
      { kind: "paragraph", spans: [{ text: "Grazie e buona permanenza!" }] },
    ]);
  });

  it("reads a plain intro as one paragraph", () => {
    expect(parseDocument("Nell'appartamento ci sono tante cose nuove. Le riconosci?")).toEqual([
      { kind: "paragraph", spans: [{ text: "Nell'appartamento ci sono tante cose nuove. Le riconosci?" }] },
    ]);
  });

  it("starts a new block at a heading even without a blank line before it", () => {
    expect(parseDocument("# Avviso\nLa luce è spenta.")).toEqual([
      { kind: "heading", spans: [{ text: "Avviso" }] },
      { kind: "paragraph", spans: [{ text: "La luce è spenta." }] },
    ]);
  });
});
