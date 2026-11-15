import { describe, expect, it } from "vitest";
import { ui } from "./ui-it";

describe("ui.lesson.footerCounter (SPEC §6.2)", () => {
  it("counts exercises and points", () => {
    expect(ui.lesson.footerCounter({ completed: 0, total: 9, points: 0 })).toBe("0 di 9 esercizi completati. 0 punti.");
    expect(ui.lesson.footerCounter({ completed: 5, total: 9, points: 3 })).toBe("5 di 9 esercizi completati. 3 punti.");
  });

  it("uses the singular for one point and for a step with one exercise", () => {
    expect(ui.lesson.footerCounter({ completed: 1, total: 9, points: 1 })).toBe("1 di 9 esercizi completati. 1 punto.");
    expect(ui.lesson.footerCounter({ completed: 0, total: 1, points: 0 })).toBe("0 di 1 esercizio completato. 0 punti.");
    expect(ui.lesson.footerCounter({ completed: 1, total: 1, points: 1 })).toBe("1 di 1 esercizio completato. 1 punto.");
  });
});
