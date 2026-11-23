import { describe, expect, it } from "vitest";
import { linkedVocab, plainVocabLinks, splitVocabLinks } from "./vocab-links";

describe("splitVocabLinks", () => {
  it("splits text into plain runs and links, in order", () => {
    expect(splitVocabLinks("Sì: la [[valigia|v-valigia]], lo [[zaino|v-zaino]].")).toEqual([
      { text: "Sì: la " },
      { word: "valigia", vocabId: "v-valigia" },
      { text: ", lo " },
      { word: "zaino", vocabId: "v-zaino" },
      { text: "." },
    ]);
  });

  it("leaves out empty runs, so a text that is one link is one piece", () => {
    expect(splitVocabLinks("[[in ritardo|v-ritardo]]")).toEqual([{ word: "in ritardo", vocabId: "v-ritardo" }]);
  });

  it("gives text without links back as one run", () => {
    expect(splitVocabLinks("Benvenuto a Genova!")).toEqual([{ text: "Benvenuto a Genova!" }]);
  });
});

describe("plainVocabLinks", () => {
  it("shows each link as its word, for speech and subtitles", () => {
    expect(plainVocabLinks("Com'è andato il [[viaggio|v-viaggio]]?")).toBe("Com'è andato il viaggio?");
  });
});

describe("linkedVocab", () => {
  it("gives the entries the lesson links to, in vocab order, for the popovers", () => {
    const lesson = {
      vocab: [{ id: "v-ombrello" }, { id: "v-valigia" }, { id: "v-zaino" }],
      scene: { lines: [{ it: "La [[valigia|v-valigia]], lo zaino…?" }] },
      steps: [{ items: [{ prompt: "E l'[[ombrello|v-ombrello]]?" }] }],
    };
    expect(linkedVocab(lesson)).toEqual([{ id: "v-ombrello" }, { id: "v-valigia" }]);
  });
});
