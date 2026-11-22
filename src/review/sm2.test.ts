import { describe, expect, it } from "vitest";
import { type Grade, NEW_SCHEDULE, type Schedule, sm2 } from "./sm2";

const CARD = "6f0c1a52-3d0e-4b8e-9a51-2f7d0c7f9b11";

/** Applies the grades in order to a new card. */
function after(grades: readonly Grade[], from: Schedule = NEW_SCHEDULE, card = CARD): ReturnType<typeof sm2> {
  return grades.reduce((schedule, grade) => sm2(card, schedule, grade), { ...from, dueInDays: 0 });
}

describe("sm2 (SPEC §10.5, ADR-0004)", () => {
  it("starts a card with ease 2.5", () => {
    expect(NEW_SCHEDULE).toEqual({ intervalDays: 0, ease: 2.5, reps: 0, lapses: 0 });
  });

  it("good goes 1 day, then 6 days, then interval × ease", () => {
    expect(after(["good"]).intervalDays).toBe(1);
    expect(after(["good", "good"]).intervalDays).toBe(6);
    expect(after(["good", "good", "good"])).toMatchObject({ intervalDays: 15, ease: 2.5, reps: 3, lapses: 0 });
  });

  it("again: due tomorrow, ease −0.2, a lapse, reps back to 0", () => {
    expect(after(["good", "good", "good", "again"])).toMatchObject({ intervalDays: 1, ease: 2.3, reps: 0, lapses: 1, dueInDays: 1 });
  });

  it("hard: interval × 1.2, ease −0.15", () => {
    expect(after(["good", "good", "hard"])).toMatchObject({ intervalDays: 7.2, ease: 2.35, reps: 3 });
  });

  it("easy: the good interval × 1.3, ease +0.15", () => {
    expect(after(["good", "good", "easy"])).toMatchObject({ intervalDays: 19.5, ease: 2.65, reps: 3 });
  });

  it("hard on a new card still waits at least a day", () => {
    expect(after(["hard"]).intervalDays).toBe(1);
  });

  it("never lets ease drop below 1.3", () => {
    expect(after(["again", "again", "again", "again", "again", "again"]).ease).toBe(1.3);
    expect(after(["hard", "hard", "hard", "hard", "hard", "hard", "hard", "hard"]).ease).toBe(1.3);
  });

  it("caps intervals at 180 days", () => {
    const long = after(["good", "good", "good", "good", "good", "good", "good"]);
    expect(long.intervalDays).toBe(180);
    expect(long.dueInDays).toBeLessThanOrEqual(180);
  });

  it("fuzzes the due day by at most 5 %, the same way every time for a card and its reps", () => {
    // Good on a 40-day card: 100 days, so 95 to 105 with the fuzz.
    const schedule: Schedule = { intervalDays: 40, ease: 2.5, reps: 5, lapses: 0 };
    const due = (card: string) => sm2(card, schedule, "good").dueInDays;
    const days = ["a", "b", "c", "d", "e", "f", "g", "h"].map((suffix) => due(`${CARD}-${suffix}`));
    for (const day of days) {
      expect(day).toBeGreaterThanOrEqual(95);
      expect(day).toBeLessThanOrEqual(105);
    }
    expect(new Set(days).size).toBeGreaterThan(1);
    expect(due(CARD)).toBe(due(CARD));
    expect(sm2(CARD, { ...schedule, reps: 6 }, "good").intervalDays).toBe(100);
  });
});
