import { describe, expect, it } from "vitest";
import { checkGaps, compareTyped } from "./compare";

const gap = (answer: string, extra: { accept?: string[]; case_sensitive?: boolean } = {}) => ({ id: "g1", answer, ...extra });

describe("compareTyped", () => {
  it("accepts the exact answer", () => {
    expect(compareTyped("l'ombrello", gap("l'ombrello"))).toBe("correct");
  });

  it("ignores surrounding whitespace and collapses inner runs", () => {
    expect(compareTyped("  sono   di\tGenova ", gap("sono di Genova"))).toBe("correct");
  });

  it("treats straight and curly apostrophes as equal, both ways", () => {
    expect(compareTyped("l’ombrello", gap("l'ombrello"))).toBe("correct");
    expect(compareTyped("l'ombrello", gap("l’ombrello"))).toBe("correct");
  });

  it("flags a miss whose only difference is an accent, for the Controlla l'accento hint", () => {
    expect(compareTyped("e", gap("è"))).toBe("accent_only");
    expect(compareTyped("pero", gap("però"))).toBe("accent_only");
    expect(compareTyped("perché", gap("perchè"))).toBe("accent_only");
    expect(compareTyped("Lei e Adam?", gap("Lei è Adam?"))).toBe("accent_only");
    expect(compareTyped("é", gap("e"))).toBe("accent_only");
  });

  it("treats a decomposed accent (e + combining grave) as the same letter", () => {
    expect(compareTyped("è", gap("è"))).toBe("correct");
  });

  it("accepts any listed alternative", () => {
    const g = gap("Piacere", { accept: ["Molto piacere", "Piacere mio"] });
    expect(compareTyped("Piacere mio", g)).toBe("correct");
    expect(compareTyped("molto piacere", g)).toBe("wrong");
  });

  it("flags an accent-only miss against an alternative too", () => {
    expect(compareTyped("cosi", gap("in questo modo", { accept: ["così"] }))).toBe("accent_only");
  });

  it("is case-sensitive by default", () => {
    expect(compareTyped("lei", gap("Lei"))).toBe("wrong");
  });

  it("ignores case when the gap says so, keeping the accent check", () => {
    const g = gap("È", { case_sensitive: false, accept: ["Lei"] });
    expect(compareTyped("è", g)).toBe("correct");
    expect(compareTyped("LEI", g)).toBe("correct");
    expect(compareTyped("e", g)).toBe("accent_only");
  });

  it("calls any other miss wrong", () => {
    expect(compareTyped("il ombrelo", gap("l'ombrèllo"))).toBe("wrong");
    expect(compareTyped("il ombrello", gap("l'ombrello"))).toBe("wrong");
    expect(compareTyped("pera", gap("però"))).toBe("wrong");
    expect(compareTyped("", gap("è"))).toBe("wrong");
  });
});

describe("checkGaps", () => {
  const gaps = [
    { id: "g1", answer: "l'" },
    { id: "g2", answer: "è" },
    { id: "g3", answer: "lo" },
  ];

  it("is fully correct only when every gap is", () => {
    expect(checkGaps(gaps, { g1: "l’", g2: "è", g3: " lo " })).toEqual({
      correct: true,
      gaps: { g1: "correct", g2: "correct", g3: "correct" },
    });
  });

  it("reports each gap, so right parts lock and wrong parts stay editable", () => {
    expect(checkGaps(gaps, { g1: "l'", g2: "e", g3: "il" })).toEqual({
      correct: false,
      gaps: { g1: "correct", g2: "accent_only", g3: "wrong" },
    });
  });

  it("counts an empty or missing gap as wrong", () => {
    expect(checkGaps(gaps, { g1: "l'", g2: "" })).toEqual({
      correct: false,
      gaps: { g1: "correct", g2: "wrong", g3: "wrong" },
    });
  });

  it("makes an item with only an accent-only miss not correct", () => {
    expect(checkGaps([{ id: "g1", answer: "è" }], { g1: "e" }).correct).toBe(false);
  });
});
