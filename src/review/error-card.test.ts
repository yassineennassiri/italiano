import { describe, expect, it } from "vitest";
import { getsErrorCard, newCorrectionWriteSchema, planErrorReview, planNewCorrection } from "./error-card";
import { type ErrorReviewWrite, reviewWriteSchema } from "./plan";

/** 11:00 in Genoa on 20 November; the next day starts at 23:00 UTC. */
const NOW = new Date("2026-11-20T10:00:00.000Z");
const TOMORROW = new Date("2026-11-20T23:00:00.000Z");
const EVENT_ID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const TAGS = new Set(["congiuntivo.volere_che", "verb.conjugation"]);

const form = {
  eventId: EVENT_ID,
  at: NOW.toISOString(),
  given: "voglio che tu esse",
  expected: "voglio che tu sia",
  errorTags: ["congiuntivo.volere_che"],
  note: "",
};

describe("Aggiungi una correzione: the write (SPEC §10.5)", () => {
  it("can't be sent with an empty Cosa hai detto or Versione corretta, blanks included", () => {
    for (const blank of ["", "   "]) {
      expect(newCorrectionWriteSchema.safeParse({ ...form, given: blank }).success).toBe(false);
      expect(newCorrectionWriteSchema.safeParse({ ...form, expected: blank }).success).toBe(false);
    }
    expect(newCorrectionWriteSchema.safeParse(form).success).toBe(true);
  });

  it("writes a manual error_log row with its tags and note, and its error card, due tomorrow", () => {
    const write = newCorrectionWriteSchema.parse({ ...form, given: "  voglio che tu esse ", note: " con il tutor " });
    const plan = planNewCorrection({ write, knownTags: TAGS, now: NOW, newCardId: () => "card-1" });
    expect(plan?.errorRow).toEqual({
      id: EVENT_ID,
      source: "manual",
      errorTags: ["congiuntivo.volere_che"],
      given: "voglio che tu esse",
      expected: "voglio che tu sia",
      note: "con il tutor",
      createdAt: NOW,
    });
    expect(plan?.card).toMatchObject({
      id: "card-1",
      kind: "error",
      refId: EVENT_ID,
      dueAt: TOMORROW,
      intervalDays: 1,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      streak: 0,
      lastResult: null,
    });
  });

  it("keeps no note when it is left empty, and allows no tags", () => {
    const write = newCorrectionWriteSchema.parse({ ...form, errorTags: [] });
    const plan = planNewCorrection({ write, knownTags: TAGS, now: NOW, newCardId: () => "card-1" });
    expect(plan?.errorRow).toMatchObject({ errorTags: [], note: null });
  });

  it("plans nothing for a tag that error-tags.json doesn't have", () => {
    const write = newCorrectionWriteSchema.parse({ ...form, errorTags: ["congiuntivo.volere_che", "made.up"] });
    expect(planNewCorrection({ write, knownTags: TAGS, now: NOW, newCardId: () => "card-1" })).toBeUndefined();
  });
});

describe("getsErrorCard: which error_log rows get an error card (SPEC §10.5)", () => {
  it("only rows with both given and expected, from a correction (manual, later ai)", () => {
    const both = { given: "il ombrello", expected: "l'ombrello" };
    expect(getsErrorCard({ source: "manual", ...both })).toBe(true);
    expect(getsErrorCard({ source: "ai", ...both })).toBe(true);
    expect(getsErrorCard({ source: "manual", given: "il ombrello", expected: null })).toBe(false);
    expect(getsErrorCard({ source: "manual", given: null, expected: "l'ombrello" })).toBe(false);
    expect(getsErrorCard({ source: "manual", given: " ", expected: "l'ombrello" })).toBe(false);
  });

  it("not rows from exercises or speaking, which feed item cards, nor Parla! notes, which are only logged", () => {
    const both = { given: "il ombrello", expected: "l'ombrello" };
    for (const source of ["exercise", "speak_rate", "parla", "parla_note"] as const) expect(getsErrorCard({ source, ...both })).toBe(false);
  });
});

describe("planErrorReview: the typed correction (SPEC §5.1, §10.5)", () => {
  const CARD_ID = "0b6a3f9e-5c1d-4e2a-8f7b-3c9d1e2f4a5b";
  const AT = "2026-11-21T07:59:00.000Z";
  const LATER = new Date("2026-11-21T08:00:00.000Z");
  const card = { id: CARD_ID, refId: EVENT_ID, intervalDays: 1, ease: 2.5, reps: 0, lapses: 0, streak: 0 };
  const row = { given: "lui e arrivato ieri", expected: "Lui è arrivato all'una." };
  const write = (text: string | null): ErrorReviewWrite =>
    reviewWriteSchema.parse({ eventId: EVENT_ID, cardId: CARD_ID, at: AT, source: "hub", kind: "rewrite", text }) as ErrorReviewWrite;
  const gradeOf = (text: string | null) => planErrorReview({ card, row, write: write(text), now: LATER }).grade;

  it("grades the right sentence good, with the compare rules: spaces collapsed, curly apostrophes equal", () => {
    expect(gradeOf("Lui è arrivato all'una.")).toBe("good");
    expect(gradeOf("  Lui   è arrivato all’una. ")).toBe("good");
  });

  it("grades an accent-only miss hard", () => {
    expect(gradeOf("Lui e arrivato all'una.")).toBe("hard");
  });

  it("grades a wrong sentence again, and so is Soluzione", () => {
    expect(gradeOf("Lui è arrivato alla una.")).toBe("again");
    expect(gradeOf("lui è arrivato all'una.")).toBe("again");
    expect(gradeOf(null)).toBe("again");
  });

  it("reschedules the card and logs the review, which resolves the row on the third non-again grade in a row", () => {
    const plan = planErrorReview({ card, row, write: write("Lui è arrivato all'una."), now: LATER });
    expect(plan.card).toMatchObject({ id: CARD_ID, reps: 1, streak: 1, lastResult: "good" });
    expect(plan.log).toMatchObject({ id: EVENT_ID, cardId: CARD_ID, grade: "good", source: "hub", createdAt: new Date(AT) });
    expect(plan.resolves).toBe(false);
    const third = planErrorReview({ card: { ...card, reps: 2, streak: 2 }, row, write: write("Lui e arrivato all'una."), now: LATER });
    expect(third.resolves).toBe(true);
  });
});
