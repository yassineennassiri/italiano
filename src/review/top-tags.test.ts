import { describe, expect, it } from "vitest";
import { topErrorTags } from "./top-tags";

const tags = ["article.elision", "article.lo", "article.plural_gli", "prep.articulated", "register.lei", "verb.conjugation", "speaking"].map((id) => ({
  id,
  explanation_en: `About ${id}.`,
}));

const rows = (...tagLists: string[][]) => tagLists.map((errorTags) => ({ errorTags }));

describe("topErrorTags", () => {
  it("counts each row once per tag it carries, most frequent first, with the tag's English explanation", () => {
    const top = topErrorTags(rows(["article.lo"], ["article.elision", "article.lo"], ["article.lo", "article.lo"], ["article.elision"], ["register.lei"]), tags);
    expect(top).toEqual([
      { id: "article.lo", count: 3, explanation: "About article.lo." },
      { id: "article.elision", count: 2, explanation: "About article.elision." },
      { id: "register.lei", count: 1, explanation: "About register.lei." },
    ]);
  });

  it("keeps the top 5, ties by tag id", () => {
    const top = topErrorTags(
      rows(["speaking"], ["verb.conjugation"], ["register.lei"], ["prep.articulated"], ["article.plural_gli"], ["article.lo"], ["article.lo"]),
      tags,
    );
    expect(top.map((tag) => [tag.id, tag.count])).toEqual([
      ["article.lo", 2],
      ["article.plural_gli", 1],
      ["prep.articulated", 1],
      ["register.lei", 1],
      ["speaking", 1],
    ]);
  });

  it("leaves out tags error-tags.json no longer has, and is empty with no rows", () => {
    expect(topErrorTags(rows(["article.gone"], ["article.gone"], ["speaking"]), tags).map((tag) => tag.id)).toEqual(["speaking"]);
    expect(topErrorTags([], tags)).toEqual([]);
  });
});
