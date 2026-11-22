/**
 * `npm run test:db`: item cards and review answers against the Neon `dev`
 * branch (SPEC §10.5). Every test gets its own throwaway profile, deleted with
 * its rows afterwards.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { exerciseHashes } from "@/content/hash";
import { loadLesson } from "@/content/load";
import { connect } from "@/db/connect";
import { databaseUrl, loadLocalEnv } from "@/db/env";
import { MIGRATIONS_DIR, migrateDatabase } from "@/db/migrate";
import { errorLog, exerciseAttempt, itemState, lessonProgress, profile, reviewCard, reviewLog } from "@/db/schema";
import type { ExerciseWrite } from "@/progress/plan";
import { loadLessonEntries, saveExerciseWrite, saveFinish, saveReset } from "@/progress/store";
import type { NewCorrectionWrite } from "./error-card";
import type { DrillWrite, ReviewWrite } from "./plan";
import { loadDueCards, loadItemCardRefs, loadTopErrorTags, saveDrillWrite, saveNewCorrection, saveReviewWrite } from "./store";

loadLocalEnv();
const db = connect(databaseUrl("dev"));
const LESSON = "a2.u01.l01";
const I01 = "a2.u01.l01.s01.i01";
const lesson = loadLesson(LESSON)!;
const HASH = exerciseHashes(lesson).get(I01)!;
/** 11:00 in Genoa on 20 November; tomorrow starts at 23:00 UTC. */
const NOW = new Date("2026-11-20T10:00:00.000Z");
const TOMORROW = new Date("2026-11-20T23:00:00.000Z");
const users: string[] = [];

beforeAll(() => migrateDatabase(db));

afterEach(async () => {
  for (const user of users.splice(0)) {
    for (const table of [itemState, exerciseAttempt, errorLog, lessonProgress, reviewLog, reviewCard]) await db.delete(table).where(eq(table.userId, user));
    await db.delete(profile).where(eq(profile.id, user));
  }
});

async function newUser(): Promise<string> {
  const user = randomUUID();
  users.push(user);
  await db.insert(profile).values({ id: user, displayName: "test" });
  return user;
}

const pick = (option: number): ExerciseWrite => ({
  eventId: randomUUID(),
  lessonId: LESSON,
  exerciseId: I01,
  contentHash: HASH,
  at: NOW.toISOString(),
  kind: "pick",
  option,
});

const reviewPick = (cardId: string, option: number, at: Date): ReviewWrite => ({
  eventId: randomUUID(),
  cardId,
  exerciseId: I01,
  contentHash: HASH,
  at: at.toISOString(),
  source: "hub",
  kind: "pick",
  option,
});

const days = (count: number) => new Date(NOW.getTime() + count * 86_400_000);

describe("item cards from lesson answers", () => {
  it("a wrong first Check creates an item card that is due from tomorrow", async () => {
    const user = await newUser();
    await saveExerciseWrite(db, user, pick(2), NOW);

    const [card] = await db.select().from(reviewCard).where(eq(reviewCard.userId, user));
    expect(card).toMatchObject({ kind: "item", refId: I01, dueAt: TOMORROW, intervalDays: 1, ease: 2.5, streak: 0 });
    expect(await loadDueCards(db, user, NOW)).toEqual([]);
    expect(await loadDueCards(db, user, TOMORROW)).toEqual([{ id: card.id, kind: "item", refId: I01 }]);
  });

  it("a wrong first Check after Azzera grades the existing card again, and logs it with source lesson", async () => {
    const user = await newUser();
    await saveExerciseWrite(db, user, pick(2), NOW);
    await saveReset(db, user, { scope: "lesson", lessonId: LESSON, at: days(1).toISOString() }, days(1));
    const again = { ...pick(2), at: days(2).toISOString() };
    await saveExerciseWrite(db, user, again, days(2));

    const [card] = await db.select().from(reviewCard).where(eq(reviewCard.userId, user));
    expect(card).toMatchObject({ lapses: 1, lastResult: "again", dueAt: new Date("2026-11-22T23:00:00.000Z") });
    expect(await db.select().from(reviewLog).where(eq(reviewLog.userId, user))).toMatchObject([
      { id: again.eventId, cardId: card.id, grade: "again", source: "lesson" },
    ]);
  });

  it("a right first Check creates none", async () => {
    const user = await newUser();
    await saveExerciseWrite(db, user, pick(0), NOW);
    expect(await db.select().from(reviewCard).where(eq(reviewCard.userId, user))).toEqual([]);
  });
});

describe("saveReviewWrite", () => {
  it("reschedules the card and logs the review, without touching item_state, the lesson % or the error log", async () => {
    const user = await newUser();
    await saveExerciseWrite(db, user, pick(2), NOW);
    const [{ id }] = await db.select().from(reviewCard).where(eq(reviewCard.userId, user));
    const entriesBefore = await loadLessonEntries(db, user, lesson);
    const [progressBefore] = await db.select().from(lessonProgress).where(eq(lessonProgress.userId, user));

    const write = reviewPick(id, 0, days(1));
    expect(await saveReviewWrite(db, user, write, days(1))).toEqual({ result: "saved" });

    expect(await db.select().from(reviewCard).where(eq(reviewCard.userId, user))).toMatchObject([
      { id, reps: 1, streak: 1, lastResult: "good", dueAt: new Date("2026-11-21T23:00:00.000Z") },
    ]);
    expect(await db.select().from(reviewLog).where(eq(reviewLog.userId, user))).toMatchObject([
      { id: write.eventId, cardId: id, grade: "good", intervalBefore: 1, intervalAfter: 1, source: "hub" },
    ]);
    const reviews = await db
      .select()
      .from(exerciseAttempt)
      .where(and(eq(exerciseAttempt.userId, user), eq(exerciseAttempt.action, "review")));
    expect(reviews).toMatchObject([{ itemId: I01, lessonId: LESSON, correct: true, answer: { picks: [0] } }]);
    expect(await loadLessonEntries(db, user, lesson)).toEqual(entriesBefore);
    expect(await db.select().from(lessonProgress).where(eq(lessonProgress.userId, user))).toEqual([progressBefore]);
    expect(await db.select().from(errorLog).where(eq(errorLog.userId, user))).toHaveLength(1);

    // A retry after a lost response changes nothing.
    expect(await saveReviewWrite(db, user, write, days(1))).toEqual({ result: "ignored" });
    expect(await db.select().from(reviewLog).where(eq(reviewLog.userId, user))).toHaveLength(1);
  });

  it("a wrong review writes no new error_log row", async () => {
    const user = await newUser();
    await saveExerciseWrite(db, user, pick(2), NOW);
    const [{ id }] = await db.select().from(reviewCard).where(eq(reviewCard.userId, user));
    await saveReviewWrite(db, user, reviewPick(id, 2, days(1)), days(1));
    expect(await db.select().from(reviewCard).where(eq(reviewCard.userId, user))).toMatchObject([{ lapses: 1, lastResult: "again" }]);
    expect(await db.select().from(errorLog).where(eq(errorLog.userId, user))).toHaveLength(1);
  });

  it("three non-again grades in a row mark the card's error_log rows resolved", async () => {
    const user = await newUser();
    await saveExerciseWrite(db, user, pick(2), NOW);
    const [{ id }] = await db.select().from(reviewCard).where(eq(reviewCard.userId, user));
    const resolved = async () => (await db.select().from(errorLog).where(eq(errorLog.userId, user))).map((row) => row.resolved);

    await saveReviewWrite(db, user, reviewPick(id, 0, days(1)), days(1));
    await saveReviewWrite(db, user, reviewPick(id, 0, days(2)), days(2));
    expect(await resolved()).toEqual([false]);
    await saveReviewWrite(db, user, reviewPick(id, 0, days(8)), days(8));
    expect(await resolved()).toEqual([true]);
  });
});

describe("the item card backfill (drizzle/0002_backfill_item_cards.sql)", () => {
  it("gives unresolved exercise and speaking errors an item card due tomorrow, and nothing else", async () => {
    const user = await newUser();
    const E2 = "a2.u01.l01.s05.i01.e2";
    const row = (fields: Partial<typeof errorLog.$inferInsert>) => ({ userId: user, source: "exercise" as const, lessonId: LESSON, ...fields });
    await db.insert(errorLog).values([
      row({ itemId: I01 }),
      row({ itemId: I01 }),
      row({ itemId: E2, source: "speak_rate" }),
      row({ itemId: "a2.u01.l01.s02.i01", resolved: true }),
      row({ itemId: "a2.u01.l01.s03.i01", errorTags: ["article.plural_gli", "spelling.accent"] }),
      row({ itemId: "a2.u01.l01.s06.i01", source: "parla" }),
    ]);

    const backfill = fs.readFileSync(path.join(MIGRATIONS_DIR, "0002_backfill_item_cards.sql"), "utf8");
    await db.execute(sql.raw(backfill));

    const cards = await db.select().from(reviewCard).where(eq(reviewCard.userId, user));
    expect(cards.map((card) => card.refId).sort()).toEqual([I01, E2]);
    for (const card of cards) {
      expect(card).toMatchObject({ kind: "item", intervalDays: 1, ease: 2.5, reps: 0, streak: 0 });
      const hoursAhead = (card.dueAt.getTime() - Date.now()) / 3_600_000;
      expect(hoursAhead).toBeGreaterThan(0);
      expect(hoursAhead).toBeLessThanOrEqual(24);
    }
  });
});

describe("vocab cards from finishing a lesson", () => {
  const vocabCards = (user: string) => db.select().from(reviewCard).where(and(eq(reviewCard.userId, user), eq(reviewCard.kind, "vocab")));

  it("finishing creates one vocab card per entry, due tomorrow; finishing again creates no duplicates and keeps their schedule", async () => {
    const user = await newUser();
    await saveFinish(db, user, { lessonId: LESSON }, NOW);

    const cards = await vocabCards(user);
    expect(cards).toHaveLength(lesson.vocab.length);
    expect(cards.map((card) => card.refId)).toContain("a2.u01.l01.v-ombrello");
    for (const card of cards) expect(card).toMatchObject({ dueAt: TOMORROW, intervalDays: 1, ease: 2.5, reps: 0 });

    await saveFinish(db, user, { lessonId: LESSON }, days(3));
    expect((await vocabCards(user)).sort((a, b) => a.id.localeCompare(b.id))).toEqual(cards.sort((a, b) => a.id.localeCompare(b.id)));
  });
});

describe("vocab cards from a Finish synced late", () => {
  it("are due the day after the learner finished, not the day after the write arrived", async () => {
    const user = await newUser();
    await saveFinish(db, user, { lessonId: LESSON, at: NOW.toISOString() }, days(3));
    const cards = await db.select().from(reviewCard).where(and(eq(reviewCard.userId, user), eq(reviewCard.kind, "vocab")));
    expect(cards.map((card) => card.dueAt)).toEqual(cards.map(() => TOMORROW));
  });
});

describe("saveReviewWrite for a vocab card", () => {
  const grade = (cardId: string, given: "again" | "good", at: Date): ReviewWrite => ({
    eventId: randomUUID(),
    cardId,
    at: at.toISOString(),
    source: "hub",
    kind: "grade",
    grade: given,
  });

  it("reschedules the card and logs the grade, with no exercise attempt; a retry, or a grade for an item card, is ignored", async () => {
    const user = await newUser();
    await saveFinish(db, user, { lessonId: LESSON }, NOW);
    const [card] = await db
      .select()
      .from(reviewCard)
      .where(and(eq(reviewCard.userId, user), eq(reviewCard.refId, "a2.u01.l01.v-ombrello")));

    const write = grade(card.id, "again", days(1));
    expect(await saveReviewWrite(db, user, write, days(1))).toEqual({ result: "saved" });
    expect(await saveReviewWrite(db, user, write, days(1))).toEqual({ result: "ignored" });

    const [after] = await db.select().from(reviewCard).where(eq(reviewCard.id, card.id));
    expect(after).toMatchObject({ lapses: 1, streak: 0, lastResult: "again", dueAt: new Date("2026-11-21T23:00:00.000Z") });
    expect(await db.select().from(reviewLog).where(eq(reviewLog.userId, user))).toMatchObject([
      { id: write.eventId, cardId: card.id, grade: "again", source: "hub" },
    ]);
    expect(await db.select().from(exerciseAttempt).where(eq(exerciseAttempt.userId, user))).toEqual([]);

    await saveExerciseWrite(db, user, pick(2), NOW);
    const [itemCard] = await db.select().from(reviewCard).where(and(eq(reviewCard.userId, user), eq(reviewCard.kind, "item")));
    expect(await saveReviewWrite(db, user, grade(itemCard.id, "good", days(1)), days(1))).toEqual({ result: "ignored" });
  });
});

describe("the vocab card backfill (drizzle/0004_backfill_vocab_cards.sql)", () => {
  it("gives every vocab entry of a completed lesson a card due tomorrow, keeps existing cards, and skips lessons not completed", async () => {
    const user = await newUser();
    const progress = (lessonId: string, status: "in_progress" | "completed") => ({ userId: user, lessonId, contentVersion: 1, status });
    await db.insert(lessonProgress).values([progress(LESSON, "completed"), progress("a2.u01.l02", "in_progress")]);
    const existing = { id: randomUUID(), userId: user, kind: "vocab" as const, refId: "a2.u01.l01.v-ombrello", dueAt: days(30), intervalDays: 30, ease: 2.6, reps: 4 };
    await db.insert(reviewCard).values(existing);

    const backfill = fs.readFileSync(path.join(MIGRATIONS_DIR, "0004_backfill_vocab_cards.sql"), "utf8");
    await db.execute(sql.raw(backfill));

    const cards = await db.select().from(reviewCard).where(eq(reviewCard.userId, user));
    expect(cards.map((card) => card.refId).sort()).toEqual(lesson.vocab.map((entry) => `${LESSON}.${entry.id}`).sort());
    expect(cards.find((card) => card.id === existing.id)).toMatchObject({ intervalDays: 30, reps: 4, dueAt: days(30) });
    for (const card of cards.filter((one) => one.id !== existing.id)) {
      expect(card).toMatchObject({ kind: "vocab", intervalDays: 1, ease: 2.5, reps: 0, streak: 0 });
      const hoursAhead = (card.dueAt.getTime() - Date.now()) / 3_600_000;
      expect(hoursAhead).toBeGreaterThan(0);
      expect(hoursAhead).toBeLessThanOrEqual(24);
    }
  });
});

const correction = (fields: Partial<NewCorrectionWrite> = {}): NewCorrectionWrite => ({
  eventId: randomUUID(),
  at: NOW.toISOString(),
  given: "lui e arrivato",
  expected: "Lui è arrivato.",
  errorTags: ["spelling.accent", "verb.conjugation"],
  note: "dal tutor",
  ...fields,
});

const rewrite = (cardId: string, text: string | null, at: Date): ReviewWrite => ({
  eventId: randomUUID(),
  cardId,
  at: at.toISOString(),
  source: "hub",
  kind: "rewrite",
  text,
});

describe("saveNewCorrection (Aggiungi una correzione)", () => {
  it("writes a manual error_log row with its tags and an error card due tomorrow; a retry adds nothing", async () => {
    const user = await newUser();
    const write = correction();
    expect(await saveNewCorrection(db, user, write, NOW)).toEqual({ result: "saved" });
    expect(await saveNewCorrection(db, user, write, NOW)).toEqual({ result: "ignored" });

    expect(await db.select().from(errorLog).where(eq(errorLog.userId, user))).toMatchObject([
      {
        id: write.eventId,
        source: "manual",
        errorTags: ["spelling.accent", "verb.conjugation"],
        given: "lui e arrivato",
        expected: "Lui è arrivato.",
        note: "dal tutor",
        lessonId: null,
        itemId: null,
        resolved: false,
      },
    ]);
    const cards = await db.select().from(reviewCard).where(eq(reviewCard.userId, user));
    expect(cards).toMatchObject([{ kind: "error", refId: write.eventId, dueAt: TOMORROW, intervalDays: 1, ease: 2.5, streak: 0 }]);
    expect(await loadDueCards(db, user, NOW)).toEqual([]);
    expect(await loadDueCards(db, user, TOMORROW)).toEqual([
      {
        id: cards[0].id,
        kind: "error",
        refId: write.eventId,
        correction: { given: "lui e arrivato", expected: "Lui è arrivato.", errorTags: ["spelling.accent", "verb.conjugation"], note: "dal tutor" },
      },
    ]);
  });

  it("ignores a correction with a tag error-tags.json doesn't have, and writes nothing", async () => {
    const user = await newUser();
    expect(await saveNewCorrection(db, user, correction({ errorTags: ["made.up"] }), NOW)).toEqual({ result: "ignored" });
    expect(await db.select().from(errorLog).where(eq(errorLog.userId, user))).toEqual([]);
    expect(await db.select().from(reviewCard).where(eq(reviewCard.userId, user))).toEqual([]);
  });

  it("a wrong first Check in a lesson logs given and expected but makes an item card, never an error card", async () => {
    const user = await newUser();
    await saveExerciseWrite(db, user, pick(2), NOW);
    const cards = await db.select().from(reviewCard).where(eq(reviewCard.userId, user));
    expect(cards.map((card) => card.kind)).toEqual(["item"]);
  });
});

describe("saveReviewWrite for an error card", () => {
  it("grades the typed correction, reschedules and logs it, and writes no attempt", async () => {
    const user = await newUser();
    await saveNewCorrection(db, user, correction(), NOW);
    const [{ id }] = await db.select().from(reviewCard).where(eq(reviewCard.userId, user));

    const write = rewrite(id, "Lui e arrivato.", days(1));
    expect(await saveReviewWrite(db, user, write, days(1))).toEqual({ result: "saved" });
    expect(await db.select().from(reviewCard).where(eq(reviewCard.userId, user))).toMatchObject([{ id, lastResult: "hard", streak: 1 }]);
    expect(await db.select().from(reviewLog).where(eq(reviewLog.userId, user))).toMatchObject([
      { id: write.eventId, cardId: id, grade: "hard", source: "hub" },
    ]);
    expect(await db.select().from(exerciseAttempt).where(eq(exerciseAttempt.userId, user))).toEqual([]);
    expect(await saveReviewWrite(db, user, write, days(1))).toEqual({ result: "ignored" });
  });

  it("resolves the correction's row on the third non-again grade in a row", async () => {
    const user = await newUser();
    await saveNewCorrection(db, user, correction(), NOW);
    const [{ id }] = await db.select().from(reviewCard).where(eq(reviewCard.userId, user));
    await saveReviewWrite(db, user, rewrite(id, "Lui è arrivato.", days(1)), days(1));
    await saveReviewWrite(db, user, rewrite(id, null, days(2)), days(2));
    await saveReviewWrite(db, user, rewrite(id, "Lui è arrivato.", days(3)), days(3));
    await saveReviewWrite(db, user, rewrite(id, "Lui è arrivato.", days(9)), days(9));
    expect(await db.select({ resolved: errorLog.resolved }).from(errorLog).where(eq(errorLog.userId, user))).toEqual([{ resolved: false }]);
    await saveReviewWrite(db, user, rewrite(id, "Lui è arrivato.", days(30)), days(30));
    expect(await db.select({ resolved: errorLog.resolved }).from(errorLog).where(eq(errorLog.userId, user))).toEqual([{ resolved: true }]);
  });

  it("ignores a typed correction sent for an item card, and an item answer sent for an error card", async () => {
    const user = await newUser();
    await saveExerciseWrite(db, user, pick(2), NOW);
    await saveNewCorrection(db, user, correction(), NOW);
    const cards = await db.select().from(reviewCard).where(eq(reviewCard.userId, user));
    const item = cards.find((card) => card.kind === "item")!;
    const error = cards.find((card) => card.kind === "error")!;
    expect(await saveReviewWrite(db, user, rewrite(item.id, "Lui è arrivato.", days(1)), days(1))).toEqual({ result: "ignored" });
    expect(await saveReviewWrite(db, user, reviewPick(error.id, 0, days(1)), days(1))).toEqual({ result: "ignored" });
  });
});

describe("loadTopErrorTags (I miei errori più frequenti)", () => {
  it("counts only unresolved rows from the last 30 days, of this profile", async () => {
    const user = await newUser();
    const other = await newUser();
    const row = (errorTags: string[], fields: Partial<typeof errorLog.$inferInsert> = {}) => ({ userId: user, source: "exercise" as const, errorTags, ...fields });
    await db.insert(errorLog).values([
      row(["article.lo"], { createdAt: days(-1) }),
      row(["article.lo", "article.elision"], { createdAt: days(-29) }),
      row(["article.lo"], { createdAt: days(-31) }),
      row(["article.elision"], { createdAt: days(-2), resolved: true }),
      row(["register.lei"], { createdAt: days(-3), userId: other }),
    ]);
    expect(await loadTopErrorTags(db, user, NOW)).toEqual([
      { id: "article.lo", count: 2, explanation: expect.any(String) },
      { id: "article.elision", count: 1, explanation: expect.any(String) },
    ]);
    expect(await loadTopErrorTags(db, other, days(60))).toEqual([]);
  });
});

describe("saveDrillWrite (tag drills)", () => {
  const drillPick = (option: number, at: Date): DrillWrite => ({ eventId: randomUUID(), exerciseId: I01, contentHash: HASH, at: at.toISOString(), kind: "pick", option });

  it("grades the exercise's existing item card with source drill, without touching item_state or adding an error_log row", async () => {
    const user = await newUser();
    await saveExerciseWrite(db, user, pick(2), NOW);
    const [before] = await db.select().from(reviewCard).where(eq(reviewCard.userId, user));
    const state = await db.select().from(itemState).where(eq(itemState.userId, user));

    const write = drillPick(0, days(1));
    expect(await saveDrillWrite(db, user, write, days(1))).toEqual({ result: "saved" });
    expect(await db.select().from(reviewCard).where(eq(reviewCard.userId, user))).toMatchObject([{ id: before.id, lastResult: "good", streak: 1 }]);
    expect(await db.select().from(reviewLog).where(eq(reviewLog.userId, user))).toMatchObject([{ cardId: before.id, grade: "good", source: "drill" }]);
    expect(await db.select().from(itemState).where(eq(itemState.userId, user))).toEqual(state);
    expect(await db.select().from(errorLog).where(eq(errorLog.userId, user))).toHaveLength(1);
    expect(await saveDrillWrite(db, user, write, days(1))).toEqual({ result: "ignored" });
    expect(await db.select().from(reviewLog).where(eq(reviewLog.userId, user))).toHaveLength(1);
  });

  it("creates no card for an exercise without one, even for a wrong answer: it writes only the review attempt", async () => {
    const user = await newUser();
    const write = drillPick(2, NOW);
    expect(await saveDrillWrite(db, user, write, NOW)).toEqual({ result: "saved" });
    expect(await db.select().from(reviewCard).where(eq(reviewCard.userId, user))).toEqual([]);
    expect(await db.select().from(errorLog).where(eq(errorLog.userId, user))).toEqual([]);
    expect(await db.select().from(exerciseAttempt).where(eq(exerciseAttempt.userId, user))).toMatchObject([
      { id: write.eventId, itemId: I01, action: "review", correct: false },
    ]);
    expect(await saveDrillWrite(db, user, write, NOW)).toEqual({ result: "ignored" });
    expect(await db.select().from(exerciseAttempt).where(eq(exerciseAttempt.userId, user))).toHaveLength(1);
  });

  it("ignores an exercise the content doesn't have", async () => {
    const user = await newUser();
    expect(await saveDrillWrite(db, user, { ...drillPick(0, NOW), exerciseId: "a2.u01.l01.s99.i01" }, NOW)).toEqual({ result: "ignored" });
  });
});

describe("loadItemCardRefs", () => {
  it("lists the exercises that have an item card", async () => {
    const user = await newUser();
    await saveExerciseWrite(db, user, pick(2), NOW);
    await saveNewCorrection(db, user, correction(), NOW);
    expect(await loadItemCardRefs(db, user)).toEqual(new Set([I01]));
  });
});
