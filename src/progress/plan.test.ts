import { describe, expect, it } from "vitest";
import { exerciseHashes } from "@/content/hash";
import { loadLesson } from "@/content/load";
import { copyContent, editJson, LESSON_FILE } from "@/content/test-content";
import { exerciseWriteSchema, planExerciseWrite, restoreEntries, type StoredItemRow } from "./plan";

const NOW = new Date("2026-11-20T10:10:00Z");
const AT = "2026-11-20T09:59:00.000Z";
const I02 = "a2.u01.l01.s01.i02";

/** The example lesson, with item s01.i02 tagged and solvable. */
function taggedLesson() {
  const dir = copyContent();
  editJson(dir, LESSON_FILE, (lesson) => {
    Object.assign(lesson.steps[0].items[1], { error_tags: ["register.lei"], solvable: true });
  });
  const lesson = loadLesson("a2.u01.l01", dir)!;
  return { lesson, hashes: exerciseHashes(lesson) };
}

/** What planExerciseWrite needs besides the action, for a learner with no stored progress. */
function base() {
  const { lesson, hashes } = taggedLesson();
  const input = { lesson, hashes, rows: [] as StoredItemRow[], progress: undefined, firstCheckAt: null as Date | null, now: NOW };
  return { input, hash: hashes.get(I02)! };
}

/** A pick on s01.i02, planned against `contentHash` at `at`. */
const pick = (option: number, { contentHash, at = AT, eventId = "evt-1" }: { contentHash: string; at?: string; eventId?: string }) =>
  ({ eventId, lessonId: "a2.u01.l01", exerciseId: I02, contentHash, at, kind: "pick", option }) as const;

const row = (hash: string, fields: Partial<StoredItemRow>): StoredItemRow => ({
  itemId: I02,
  status: "checked_wrong",
  firstCheckCorrect: false,
  points: 0,
  answer: { picks: [2] },
  contentHash: hash,
  ...fields,
});

describe("restoreEntries", () => {
  it("restores rows whose content hash still matches, and drops the rest", () => {
    const { lesson, hashes } = taggedLesson();
    const rows: StoredItemRow[] = [
      row(hashes.get(I02)!, {}),
      row("stale", { itemId: "a2.u01.l01.s01.i01", status: "checked_correct", firstCheckCorrect: true, points: 1 }),
      row("x", { itemId: "a2.u01.l01.s09.i01" }),
    ];
    expect(restoreEntries(lesson, hashes, rows)).toEqual(
      new Map([[I02, { state: { status: "checked_wrong", firstCheckCorrect: false, points: 0 }, answer: { picks: [2] } }]]),
    );
  });

  it("ignores a row whose stored answer doesn't fit the item", () => {
    const { lesson, hashes } = taggedLesson();
    expect(restoreEntries(lesson, hashes, [row(hashes.get(I02)!, { answer: { picks: "x" } })]).size).toBe(0);
  });
});

describe("planExerciseWrite", () => {
  it("writes a wrong first Check to item_state, the attempt history and the error log", () => {
    const { input, hash } = base();
    const plan = planExerciseWrite({ ...input, action: pick(2, { contentHash: hash }) })!;

    expect(plan.itemState).toEqual({
      itemId: I02,
      lessonId: "a2.u01.l01",
      status: "checked_wrong",
      firstCheckCorrect: false,
      points: 0,
      answer: { picks: [2] },
      contentHash: hash,
      updatedAt: NOW,
    });
    expect(plan.attempt).toEqual({
      id: "evt-1",
      itemId: I02,
      lessonId: "a2.u01.l01",
      contentVersion: 1,
      action: "check",
      answer: { picks: [2] },
      result: null,
      correct: false,
      createdAt: new Date(AT),
    });
    expect(plan.errors).toEqual([
      {
        source: "exercise",
        lessonId: "a2.u01.l01",
        itemId: I02,
        errorTags: ["register.lei"],
        expected: "Bene, ma il treno era in ritardo.",
        given: "Benissimo, il treno era in anticipo.",
        createdAt: new Date(AT),
      },
    ]);
    expect(plan.progress).toMatchObject({ lessonId: "a2.u01.l01", contentVersion: 1, status: "in_progress", lastPercent: 0, bestPercent: 0, startedAt: NOW });
  });

  it("scores a right first Check: 1 point of the lesson's 7 scorable items is 14%", () => {
    const { input, hash } = base();
    const plan = planExerciseWrite({ ...input, action: pick(0, { contentHash: hash }) })!;
    expect(plan.itemState).toMatchObject({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
    expect(plan.errors).toEqual([]);
    expect(plan.progress).toMatchObject({ lastPercent: 14, bestPercent: 14 });
  });

  it("logs no error for a wrong retry, only for the first Check", () => {
    const { input, hash } = base();
    const plan = planExerciseWrite({
      ...input,
      rows: [row(hash, {})],
      firstCheckAt: new Date("2026-11-20T09:00:00Z"),
      action: pick(1, { contentHash: hash }),
    })!;
    expect(plan.itemState.answer).toEqual({ picks: [2, 1] });
    expect(plan.errors).toEqual([]);
  });

  it("treats a row for changed content as untouched, so the next Check is the first again", () => {
    const { input, hash } = base();
    const plan = planExerciseWrite({
      ...input,
      rows: [row("old-content", { status: "checked_correct", firstCheckCorrect: true, points: 1, answer: { picks: [0] } })],
      firstCheckAt: new Date("2026-11-01T00:00:00Z"),
      action: pick(2, { contentHash: hash }),
    })!;
    expect(plan.itemState).toMatchObject({ status: "checked_wrong", firstCheckCorrect: false, answer: { picks: [2] } });
    expect(plan.errors).toHaveLength(1);
  });

  it("records Solve as an attempt without a verdict", () => {
    const { input, hash } = base();
    const action = { eventId: "evt-2", lessonId: "a2.u01.l01", exerciseId: I02, contentHash: hash, at: AT, kind: "solve" } as const;
    const plan = planExerciseWrite({ ...input, action })!;
    expect(plan.itemState).toMatchObject({ status: "solved", points: 0 });
    expect(plan.attempt).toMatchObject({ action: "solve", correct: null });
    expect(plan.errors).toEqual([]);
  });

  it("keeps a completed lesson completed, its start time, and its best %", () => {
    const { input, hash } = base();
    const startedAt = new Date("2026-11-01T09:00:00Z");
    const progress = { status: "completed" as const, startedAt, bestPercent: 86 };
    const plan = planExerciseWrite({ ...input, progress, action: pick(0, { contentHash: hash }) })!;
    expect(plan.progress).toMatchObject({ status: "completed", startedAt, lastPercent: 14, bestPercent: 86 });
  });

  it("plans nothing for an action that changes nothing or names no exercise", () => {
    const { input, hash } = base();
    const locked = [row(hash, { status: "checked_correct", firstCheckCorrect: true, points: 1, answer: { picks: [0] } })];
    const later = { contentHash: hash, at: "2026-11-20T09:59:30.000Z" };
    expect(planExerciseWrite({ ...input, rows: locked, firstCheckAt: new Date(AT), action: pick(1, later) })).toBeUndefined();
    const unknown = { ...pick(0, { contentHash: hash }), exerciseId: "a2.u01.l01.s09.i01" };
    expect(planExerciseWrite({ ...input, action: unknown })).toBeUndefined();
  });

  it("ignores a write planned against content that has changed since", () => {
    const { input } = base();
    expect(planExerciseWrite({ ...input, action: pick(0, { contentHash: "before-the-edit" }) })).toBeUndefined();
  });

  it("lets an earlier first Check win when it arrives late: a right pick made offline still earns the point", () => {
    const { input, hash } = base();
    // Another computer checked wrong at 10:05; this pick was made at 10:00 and synced afterwards.
    const plan = planExerciseWrite({
      ...input,
      rows: [row(hash, {})],
      firstCheckAt: new Date("2026-11-20T10:05:00Z"),
      action: pick(0, { contentHash: hash, at: "2026-11-20T10:00:00.000Z" }),
    })!;
    expect(plan.itemState).toMatchObject({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
    expect(plan.errors).toEqual([]);
  });

  it("lets an earlier wrong first Check win too, while the latest state stays", () => {
    const { input, hash } = base();
    const plan = planExerciseWrite({
      ...input,
      rows: [row(hash, { status: "checked_correct", firstCheckCorrect: true, points: 1, answer: { picks: [0] } })],
      firstCheckAt: new Date("2026-11-20T10:05:00Z"),
      action: pick(2, { contentHash: hash, at: "2026-11-20T10:00:00.000Z" }),
    })!;
    expect(plan.itemState).toMatchObject({ status: "checked_correct", firstCheckCorrect: false, points: 0, answer: { picks: [0] } });
    expect(plan.errors).toHaveLength(1);
  });
});

describe("planExerciseWrite for multi_select (s01.i03)", () => {
  const I03 = "a2.u01.l01.s01.i03";
  const check = (selected: number[], { contentHash, at = AT }: { contentHash: string; at?: string }) =>
    ({ eventId: "evt-3", lessonId: "a2.u01.l01", exerciseId: I03, contentHash, at, kind: "check", answer: { selected } }) as const;

  it("accepts a Controlla write from the client", () => {
    expect(exerciseWriteSchema.safeParse({ ...check([0, 2], { contentHash: "h" }), eventId: crypto.randomUUID() }).success).toBe(true);
  });

  it("writes a wrong first Check with the selection, and logs what was right and what was given", () => {
    const { input } = base();
    const hash = input.hashes.get(I03)!;
    const plan = planExerciseWrite({ ...input, action: check([1, 0], { contentHash: hash }) })!;
    expect(plan.itemState).toMatchObject({ itemId: I03, status: "checked_wrong", firstCheckCorrect: false, points: 0, answer: { selected: [0, 1] } });
    expect(plan.attempt).toMatchObject({ action: "check", correct: false, answer: { selected: [0, 1] } });
    expect(plan.errors).toEqual([
      expect.objectContaining({ itemId: I03, expected: "la valigia, lo zaino, l'ombrello", given: "la valigia, la bicicletta" }),
    ]);
  });

  it("scores a right first Check, and a right retry after a wrong one scores 0 but is stored", () => {
    const { input } = base();
    const hash = input.hashes.get(I03)!;
    const first = planExerciseWrite({ ...input, action: check([0, 2, 3], { contentHash: hash }) })!;
    expect(first.itemState).toMatchObject({ status: "checked_correct", points: 1 });
    expect(first.progress).toMatchObject({ lastPercent: 14 });

    const wrongRow = row(hash, { itemId: I03, answer: { selected: [0, 1] } });
    const retry = planExerciseWrite({
      ...input,
      rows: [wrongRow],
      firstCheckAt: new Date("2026-11-20T09:00:00Z"),
      action: check([2, 3], { contentHash: hash }),
    })!;
    expect(retry.itemState).toMatchObject({ status: "checked_correct", firstCheckCorrect: false, points: 0, answer: { selected: [0, 2, 3] } });
    expect(retry.attempt).toMatchObject({ action: "check", correct: true });
    expect(retry.errors).toEqual([]);
  });

  it("lets an earlier right Check made offline win the point, as for single_choice", () => {
    const { input } = base();
    const hash = input.hashes.get(I03)!;
    const plan = planExerciseWrite({
      ...input,
      rows: [row(hash, { itemId: I03, answer: { selected: [1] } })],
      firstCheckAt: new Date("2026-11-20T10:05:00Z"),
      action: check([0, 2, 3], { contentHash: hash, at: "2026-11-20T10:00:00.000Z" }),
    })!;
    expect(plan.itemState).toMatchObject({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
  });
});

describe("planExerciseWrite for dropdown (s02.i01)", () => {
  const ID = "a2.u01.l01.s02.i01";

  it("writes one error_log row per wrong gap on a wrong first Check, with the gap id and the item's tags", () => {
    const { input } = base();
    const hash = input.hashes.get(ID)!;
    const action = { eventId: "evt-4", lessonId: "a2.u01.l01", exerciseId: ID, contentHash: hash, at: AT, kind: "check", answer: { values: { g1: "la", g2: "il", g3: "l'" } } } as const;
    const plan = planExerciseWrite({ ...input, action })!;
    expect(plan.itemState).toMatchObject({ status: "checked_wrong", points: 0, answer: { values: { g1: "la", g2: "il", g3: "l'" } } });
    expect(plan.attempt).toMatchObject({ correct: false, result: { g1: "correct", g2: "wrong", g3: "correct", g4: "wrong" } });
    expect(plan.errors).toEqual([
      { source: "exercise", lessonId: "a2.u01.l01", itemId: ID, gapId: "g2", errorTags: ["article.elision", "article.lo"], expected: "lo", given: "il", createdAt: new Date(AT) },
      { source: "exercise", lessonId: "a2.u01.l01", itemId: ID, gapId: "g4", errorTags: ["article.elision", "article.lo"], expected: "il", given: "", createdAt: new Date(AT) },
    ]);
  });
});

describe("planExerciseWrite for text_gap (s03.i01)", () => {
  const ID = "a2.u01.l01.s03.i01";

  it("logs an accent-only miss with spelling.accent added to the item's tags", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[2].items[0].gaps[0].answer = "è";
    });
    const lesson = loadLesson("a2.u01.l01", dir)!;
    const hashes = exerciseHashes(lesson);
    const values = { g1: "e", g2: "lo", g3: "gli", g4: "le", g5: "gli" };
    const action = { eventId: "evt-5", lessonId: "a2.u01.l01", exerciseId: ID, contentHash: hashes.get(ID)!, at: AT, kind: "check", answer: { values } } as const;
    const plan = planExerciseWrite({ lesson, hashes, rows: [], progress: undefined, firstCheckAt: null, now: NOW, action })!;
    expect(plan.itemState).toMatchObject({ status: "checked_wrong", points: 0 });
    expect(plan.errors).toEqual([
      expect.objectContaining({ gapId: "g1", errorTags: ["article.plural_gli", "spelling.accent"], expected: "è", given: "e" }),
      expect.objectContaining({ gapId: "g2", errorTags: ["article.plural_gli"], expected: "gli", given: "lo" }),
    ]);
    expect(plan.attempt.result).toEqual({ g1: "accent_only", g2: "wrong", g3: "correct", g4: "correct", g5: "correct" });
  });
});

describe("planExerciseWrite for self-ratings (s05 exchanges, s06 Parla!)", () => {
  const E1 = "a2.u01.l01.s05.i01.e1";
  const E2 = "a2.u01.l01.s05.i01.e2";
  const PARLA = "a2.u01.l01.s06.i01";
  const rate = (exerciseId: string, hashes: ReadonlyMap<string, string>, rating: "good" | "not_great", note?: string) =>
    ({ eventId: "evt-r", lessonId: "a2.u01.l01", exerciseId, contentHash: hashes.get(exerciseId)!, at: AT, kind: "rate", rating, ...(note !== undefined && { note }) }) as const;

  it("writes one exchange's Non tanto bene under the exchange id, and logs it as a speak_rate error", () => {
    const { input } = base();
    const plan = planExerciseWrite({ ...input, action: rate(E2, input.hashes, "not_great") })!;
    expect(plan.itemState).toMatchObject({ itemId: E2, status: "rated_not_great", firstCheckCorrect: null, points: 0, answer: { rating: "not_great" } });
    expect(plan.attempt).toMatchObject({ id: "evt-r", itemId: E2, action: "rate", answer: { rating: "not_great" }, result: null, correct: null });
    expect(plan.errors).toEqual([
      {
        source: "speak_rate",
        lessonId: "a2.u01.l01",
        itemId: E2,
        errorTags: ["article.elision", "register.lei"],
        expected: "Bene, grazie. Il treno / L'aereo era …",
        createdAt: new Date(AT),
      },
    ]);
  });

  it("leaves points and the lesson % as they were", () => {
    const { input, hash } = base();
    const rows = [row(hash, { status: "checked_correct", firstCheckCorrect: true, points: 1, answer: { picks: [0] } })];
    const plan = planExerciseWrite({ ...input, rows, action: rate(E1, input.hashes, "good") })!;
    expect(plan.itemState).toMatchObject({ itemId: E1, status: "rated_good", points: 0 });
    expect(plan.errors).toEqual([]);
    expect(plan.progress).toMatchObject({ status: "in_progress", lastPercent: 14, bestPercent: 14 });
  });

  it("logs Parla!'s Non tanto bene and its hesitation note as separate rows", () => {
    const { input } = base();
    const plan = planExerciseWrite({ ...input, action: rate(PARLA, input.hashes, "not_great", "il plurale con gli") })!;
    expect(plan.itemState).toMatchObject({ itemId: PARLA, status: "rated_not_great", answer: { rating: "not_great", note: "il plurale con gli" } });
    expect(plan.errors).toEqual([
      { source: "parla", lessonId: "a2.u01.l01", itemId: PARLA, errorTags: ["article.elision", "article.plural_gli"], createdAt: new Date(AT) },
      {
        source: "parla_note",
        lessonId: "a2.u01.l01",
        itemId: PARLA,
        errorTags: ["article.elision", "article.plural_gli", "speaking"],
        note: "il plurale con gli",
        createdAt: new Date(AT),
      },
    ]);
  });

  it("ignores a second rating: the first one locked the exercise", () => {
    const { input } = base();
    const rated: StoredItemRow = { itemId: E2, status: "rated_good", firstCheckCorrect: null, points: 0, answer: { rating: "good" }, contentHash: input.hashes.get(E2)! };
    expect(planExerciseWrite({ ...input, rows: [rated], action: rate(E2, input.hashes, "not_great") })).toBeUndefined();
  });

  it("accepts a rating write, and rejects an unknown rating", () => {
    const { input } = base();
    const eventId = "6f1c2a4e-0b7d-4c3e-9a51-2d8e7f4b1c90";
    expect(exerciseWriteSchema.safeParse({ ...rate(PARLA, input.hashes, "good", "gli"), eventId }).success).toBe(true);
    expect(exerciseWriteSchema.safeParse({ ...rate(E1, input.hashes, "good"), eventId, rating: "great" }).success).toBe(false);
  });
});
