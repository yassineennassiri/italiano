import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { applyAction, type ExerciseAction, findExercise } from "@/items/engine";
import { type ExerciseEntry, NEW_ENTRY } from "@/items/entry";
import type { ExerciseState } from "@/scoring/exercise";
import { lessonResults, scoreBand } from "./results";

const lesson = loadLesson("a2.u01.l01")!;
const id = (suffix: string) => `a2.u01.l01.${suffix}`;

/** Plays each exercise's actions through the item engine, as the learner would, and returns the states. */
function play(script: Record<string, ExerciseAction[]>): Map<string, ExerciseState> {
  const states = new Map<string, ExerciseState>();
  for (const [suffix, actions] of Object.entries(script)) {
    const exercise = findExercise(lesson, id(suffix))!;
    const entry = actions.reduce<ExerciseEntry>((current, action) => applyAction(exercise, current, action)?.entry ?? current, NEW_ENTRY);
    states.set(exercise.id, entry.state);
  }
  return states;
}

/**
 * The scripted set: right, a correct retry, right, wrong, solved, right, one
 * word_order left alone, two of three exchanges rated, Parla! rated.
 */
const scripted = () =>
  play({
    "s01.i01": [{ kind: "pick", option: 0 }],
    "s01.i02": [{ kind: "pick", option: 1 }, { kind: "pick", option: 0 }],
    "s01.i03": [{ kind: "check", answer: { selected: [0, 2, 3] } }],
    "s02.i01": [{ kind: "check", answer: { values: { g1: "la", g2: "il", g3: "l'", g4: "il" } } }],
    "s03.i01": [{ kind: "solve" }],
    "s04.i01": [{ kind: "check", answer: { placed: [0, 1, 2, 3, 4, 5, 6] } }],
    "s05.i01.e1": [{ kind: "rate", rating: "good" }],
    "s05.i01.e2": [{ kind: "rate", rating: "not_great" }],
    "s06.i01": [{ kind: "rate", rating: "good" }],
  });

describe("lessonResults", () => {
  it("gives the % and S/M of the scoring core for a scripted set of answers", () => {
    // 3 points (s01.i01, s01.i03, s04.i01) of 7 scorable items: 42.86 → 43%.
    // Steps 1, 2, 3 and 6 are completed; step 4 has an untouched item, step 5 an unrated exchange.
    expect(lessonResults(lesson, scripted())).toMatchObject({
      percent: 43,
      completedSteps: 4,
      totalSteps: 6,
      band: "retry",
    });
  });

  it("aims Correggi i miei errori at the first step with a wrong or unattempted scorable item, reopening the wrong and solved ones", () => {
    // Step 1's correct retry is not wrong; step 2 has the wrong dropdown.
    expect(lessonResults(lesson, scripted()).correction).toEqual({
      stepNumber: 2,
      reopen: [id("s02.i01"), id("s03.i01")],
    });
  });

  it("never reopens speaking exchanges or Parla!, and has nothing to correct when every scorable item is right", () => {
    const allRight = play({
      "s01.i01": [{ kind: "pick", option: 0 }],
      "s01.i02": [{ kind: "pick", option: 0 }],
      "s01.i03": [{ kind: "check", answer: { selected: [0, 2, 3] } }],
      "s02.i01": [{ kind: "check", answer: { values: { g1: "la", g2: "lo", g3: "l'", g4: "il" } } }],
      "s03.i01": [{ kind: "check", answer: { values: { g1: "i", g2: "gli", g3: "gli", g4: "le", g5: "gli" } } }],
      "s04.i01": [{ kind: "check", answer: { placed: [0, 1, 2, 3, 4, 5, 6] } }],
      "s04.i02": [{ kind: "check", answer: { placed: [0, 1, 2, 3, 4, 5] } }],
      "s05.i01.e1": [{ kind: "rate", rating: "not_great" }],
      "s06.i01": [{ kind: "rate", rating: "not_great" }],
    });
    const results = lessonResults(lesson, allRight);
    expect(results).toMatchObject({ percent: 100, band: "great" });
    expect(results.correction).toBeUndefined();
  });

  it("aims at a step with only unattempted scorable items, with nothing to reopen", () => {
    const results = lessonResults(lesson, play({ "s01.i01": [{ kind: "pick", option: 0 }] }));
    expect(results.correction).toEqual({ stepNumber: 1, reopen: [] });
  });
});

describe("scoreBand", () => {
  it.each([
    [100, "great"],
    [80, "great"],
    [79, "good"],
    [50, "good"],
    [49, "retry"],
    [0, "retry"],
  ] as const)("puts %i%% in the %s band", (percent, band) => {
    expect(scoreBand(percent)).toBe(band);
  });
});
