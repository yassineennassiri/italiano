import { describe, expect, it } from "vitest";
import { loadLesson } from "./load";
import type { VocabEntry } from "./schema";
import { sortVocab } from "./vocab";

const entry = (it: string, sort_key?: string): VocabEntry => ({
  id: `v-${it.replace(/\W+/g, "-")}`,
  it,
  pos: "other",
  en: "…",
  ...(sort_key === undefined ? {} : { sort_key }),
});

describe("sortVocab", () => {
  it("sorts the example lesson's list ignoring the article, with in ritardo under r", () => {
    const vocab = [...loadLesson("a2.u01.l01")!.vocab].reverse();
    expect(sortVocab(vocab).map((e) => e.it)).toEqual([
      "l'appartamento",
      "il caruggio",
      "l'ombrello",
      "perdersi",
      "in ritardo",
      "lo straniero",
      "la valigia",
      "il viaggio",
      "il vicolo",
      "lo zaino",
    ]);
  });

  it("sorts a phrase by its own first word when it has no sort_key", () => {
    const sorted = sortVocab([entry("lo zaino"), entry("in ritardo"), entry("il caruggio")]);
    expect(sorted.map((e) => e.it)).toEqual(["il caruggio", "in ritardo", "lo zaino"]);
  });

  it("ignores every definite and indefinite article, elided or not, and capitals", () => {
    const words = ["gli stranieri", "Un'amica", "le valigie", "uno zaino", "una casa", "i binari", "un treno", "L'Europa"];
    expect(sortVocab(words.map((it) => entry(it))).map((e) => e.it)).toEqual([
      "Un'amica",
      "i binari",
      "una casa",
      "L'Europa",
      "gli stranieri",
      "un treno",
      "le valigie",
      "uno zaino",
    ]);
  });

  it("does not change the list it is given", () => {
    const vocab = [entry("lo zaino"), entry("il caruggio")];
    sortVocab(vocab);
    expect(vocab.map((e) => e.it)).toEqual(["lo zaino", "il caruggio"]);
  });
});
