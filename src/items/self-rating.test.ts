import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { NEW_ENTRY } from "./entry";
import { type ParlaItem, rateExchange, rateParla, ratingViews, type SpeakRateItem } from "./self-rating";

const lesson = loadLesson("a2.u01.l01")!;
/** Step 5: Signora Pina's three exchanges, tagged article.elision and register.lei. */
const speakRate = lesson.steps[4].items[0] as SpeakRateItem;
const e2 = speakRate.exchanges[1];
/** Step 6: the Parla! task, tagged article.elision and article.plural_gli. */
const parla = lesson.steps[5].items[0] as ParlaItem;

describe("rateExchange", () => {
  it("marks Bene as rated_good for no points, locks it, and logs nothing", () => {
    const rated = rateExchange(e2, NEW_ENTRY, "good")!;
    expect(rated).toEqual({
      entry: { state: { status: "rated_good", firstCheckCorrect: null, points: 0 }, answer: { rating: "good" } },
      action: "rate",
      correct: null,
      errors: [],
    });
    expect(rateExchange(e2, rated.entry, "not_great")).toBeUndefined();
  });

  it("logs Non tanto bene as a speak_rate error, with my expected reply", () => {
    const rated = rateExchange(e2, NEW_ENTRY, "not_great")!;
    expect(rated.entry.state).toEqual({ status: "rated_not_great", firstCheckCorrect: null, points: 0 });
    expect(rated.errors).toEqual([{ source: "speak_rate", expected: "Bene, grazie. Il treno / L'aereo era …" }]);
  });

  it("takes no hesitation note: that belongs to Parla!", () => {
    expect(rateExchange(e2, NEW_ENTRY, "good", "il congiuntivo")).toBeUndefined();
  });
});

describe("rateParla", () => {
  it("marks the rating for no points and locks it", () => {
    const rated = rateParla(parla, NEW_ENTRY, "good")!;
    expect(rated.entry).toEqual({ state: { status: "rated_good", firstCheckCorrect: null, points: 0 }, answer: { rating: "good" } });
    expect(rated.action).toBe("rate");
    expect(rated.errors).toEqual([]);
    expect(rateParla(parla, rated.entry, "not_great")).toBeUndefined();
  });

  it("logs Non tanto bene as a parla error, and a hesitation note as a parla_note error tagged speaking", () => {
    const rated = rateParla(parla, NEW_ENTRY, "not_great", "  il plurale con gli  ")!;
    expect(rated.entry.answer).toEqual({ rating: "not_great", note: "il plurale con gli" });
    expect(rated.errors).toEqual([{ source: "parla" }, { source: "parla_note", note: "il plurale con gli", errorTags: ["speaking"] }]);
  });

  it("logs the note with Bene too, and ignores a blank one", () => {
    expect(rateParla(parla, NEW_ENTRY, "good", "l'ombrello")!.errors).toEqual([
      { source: "parla_note", note: "l'ombrello", errorTags: ["speaking"] },
    ]);
    const blank = rateParla(parla, NEW_ENTRY, "good", "   ")!;
    expect(blank.entry.answer).toEqual({ rating: "good" });
    expect(blank.errors).toEqual([]);
  });
});

describe("ratingViews", () => {
  it("leaves both buttons open until rated, then highlights the choice and dims the other", () => {
    expect(ratingViews(NEW_ENTRY)).toEqual({ good: { look: "idle", disabled: false }, not_great: { look: "idle", disabled: false } });
    const rated = rateExchange(e2, NEW_ENTRY, "not_great")!.entry;
    expect(ratingViews(rated)).toEqual({ good: { look: "dimmed", disabled: true }, not_great: { look: "selected", disabled: true } });
  });
});
