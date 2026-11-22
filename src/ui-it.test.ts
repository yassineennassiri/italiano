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

describe("ui.results (SPEC §4.4)", () => {
  it("lists only the review pages the lesson has, with their Italian names", () => {
    expect(ui.results.nextPages(["grammatica", "vocabolario", "cultura"])).toBe(
      "Nelle prossime pagine trovi un riepilogo di: grammatica, vocabolario, cultura e società.",
    );
    expect(ui.results.nextPages(["vocabolario"])).toBe("Nelle prossime pagine trovi un riepilogo di: vocabolario.");
  });

  it("has one encouraging line per score band, and S/M on the slate panel", () => {
    expect(ui.results.band).toEqual({
      great: "Ottimo lavoro!",
      good: "Buon lavoro, continua così!",
      retry: "Riprova gli esercizi, ce la puoi fare.",
    });
    expect(ui.results.steps(4, 6)).toBe("Risultati della lezione: 4/6");
  });
});

describe("ui.level.levelStatus", () => {
  it("names the level's state and its %", () => {
    expect(ui.level.levelStatus("in_progress", 3)).toBe("Livello: In corso · 3%");
    expect(ui.level.levelStatus("not_started", 0)).toBe("Livello: Non iniziato · 0%");
  });
});

describe("ui.footer.sync (SPEC §3.1, §8)", () => {
  it("says where a waiting write is kept", () => {
    expect(ui.footer.sync).toEqual({
      saved: "Salvato",
      pending: "In attesa",
      offline: "Offline: non salvato",
      stored: "Offline: salvato su questo computer",
    });
  });
});
