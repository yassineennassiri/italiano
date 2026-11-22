/**
 * `npm run test:db`: the progress round trip against the Neon `dev` branch.
 * Every test gets its own throwaway profile, deleted with its rows afterwards.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { exerciseHashes } from "@/content/hash";
import { loadLesson } from "@/content/load";
import { connect } from "@/db/connect";
import { databaseUrl, loadLocalEnv } from "@/db/env";
import { migrateDatabase } from "@/db/migrate";
import { errorLog, exerciseAttempt, itemState, lessonProgress, profile, reviewCard, reviewLog } from "@/db/schema";
import type { ExerciseWrite } from "./plan";
import {
  loadLastLocation,
  loadLessonEntries,
  loadProgressSummaries,
  saveCorrection,
  saveExerciseWrite,
  saveFinish,
  saveReset,
  saveVisit,
} from "./store";

loadLocalEnv();
const db = connect(databaseUrl("dev"));
const LESSON = "a2.u01.l01";
const I01 = "a2.u01.l01.s01.i01";
const lesson = loadLesson(LESSON)!;
const HASH = exerciseHashes(lesson).get(I01)!;
const users: string[] = [];
const NOW = new Date("2026-11-20T10:30:05.000Z");

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

const pick = (option: number, at = "2026-11-20T10:00:00.000Z"): ExerciseWrite => ({
  eventId: randomUUID(),
  lessonId: LESSON,
  exerciseId: I01,
  contentHash: HASH,
  at,
  kind: "pick",
  option,
});

describe("progress store", () => {
  it("saves a wrong first Check and restores it on the next load", async () => {
    const user = await newUser();
    const response = await saveExerciseWrite(db, user, pick(2));
    expect(response.result).toBe("saved");

    const expected = { state: { status: "checked_wrong", firstCheckCorrect: false, points: 0 }, answer: { picks: [2] } };
    expect(response.saved?.entry).toEqual(expected);
    expect((await loadLessonEntries(db, user, lesson)).get(I01)?.entry).toEqual(expected);
    expect(await db.select().from(errorLog).where(eq(errorLog.userId, user))).toMatchObject([
      { source: "exercise", itemId: I01, expected: "La padrona di casa", given: "Nessuno" },
    ]);
    const [progress] = await db.select().from(lessonProgress).where(eq(lessonProgress.userId, user));
    expect(progress).toMatchObject({ status: "in_progress", lastPercent: 0, contentVersion: 1 });
  });

  it("applies a retried write only once, and answers the retry with the saved entry", async () => {
    const user = await newUser();
    const write = pick(1);
    await saveExerciseWrite(db, user, write);
    const retry = await saveExerciseWrite(db, user, write);

    expect(retry.result).toBe("ignored");
    expect(retry.saved?.entry.answer).toEqual({ picks: [1] });
    expect(await db.select().from(exerciseAttempt).where(eq(exerciseAttempt.userId, user))).toHaveLength(1);
  });

  it("lets a first Check made earlier but synced later win (SPEC §8)", async () => {
    const user = await newUser();
    await saveExerciseWrite(db, user, pick(2, "2026-11-20T10:05:00.000Z"));
    await saveExerciseWrite(db, user, pick(0, "2026-11-20T10:00:00.000Z"));

    expect((await loadLessonEntries(db, user, lesson)).get(I01)?.entry.state).toEqual({
      status: "checked_correct",
      firstCheckCorrect: true,
      points: 1,
    });
  });

  it("ignores a stored state once its item's content has changed", async () => {
    const user = await newUser();
    await saveExerciseWrite(db, user, pick(2));
    await db.update(itemState).set({ contentHash: "content-before-an-edit" }).where(eq(itemState.userId, user));
    expect((await loadLessonEntries(db, user, lesson)).has(I01)).toBe(false);
  });

  it("remembers the last visited step", async () => {
    const user = await newUser();
    expect(await loadLastLocation(db, user, LESSON)).toBeNull();
    await saveVisit(db, user, { lessonId: LESSON, location: "esercizi/2" });
    await saveVisit(db, user, { lessonId: LESSON, location: "esercizi/4" });
    expect(await loadLastLocation(db, user, LESSON)).toBe("esercizi/4");
  });

  it("Correggi i miei errori reopens a wrong item but never a speaking exchange, and keeps its spent first Check", async () => {
    const user = await newUser();
    const E1 = "a2.u01.l01.s05.i01.e1";
    await saveExerciseWrite(db, user, pick(2));
    await saveExerciseWrite(db, user, {
      eventId: randomUUID(),
      lessonId: LESSON,
      exerciseId: E1,
      contentHash: exerciseHashes(lesson).get(E1)!,
      at: "2026-11-20T10:01:00.000Z",
      kind: "rate",
      rating: "not_great",
    });

    const response = await saveCorrection(db, user, { lessonId: LESSON, at: "2026-11-20T10:02:00.000Z" });
    expect(response.result).toBe("saved");
    const reopened = { status: "untouched", firstCheckCorrect: false, points: 0 };
    expect(response.saved?.[I01]?.entry).toEqual({ state: reopened, answer: null });

    const entries = await loadLessonEntries(db, user, lesson);
    expect(entries.get(I01)?.entry.state).toEqual(reopened);
    expect(entries.get(E1)?.entry.state.status).toBe("rated_not_great");
    const attempts = await db.select().from(exerciseAttempt).where(eq(exerciseAttempt.userId, user));
    expect(attempts.filter((attempt) => attempt.action === "reset").map((attempt) => attempt.itemId)).toEqual([I01]);

    // A retry after a lost response changes nothing, but answers with the entries as saved.
    const retry = await saveCorrection(db, user, { lessonId: LESSON, at: "2026-11-20T10:02:00.000Z" });
    expect(retry.result).toBe("ignored");
    expect(retry.saved?.[I01]?.entry).toEqual({ state: reopened, answer: null });

    // A right retry after the correction scores 0.
    await saveExerciseWrite(db, user, pick(0, "2026-11-20T10:03:00.000Z"));
    expect((await loadLessonEntries(db, user, lesson)).get(I01)?.entry.state).toEqual({
      status: "checked_correct",
      firstCheckCorrect: false,
      points: 0,
    });
  });

  it("moves the lesson not_started → in_progress → completed, and best_percent never drops", async () => {
    const user = await newUser();
    await saveVisit(db, user, { lessonId: LESSON, location: "esercizi/1" });
    expect(await loadProgressSummaries(db, user)).toEqual([
      expect.objectContaining({ lessonId: LESSON, status: "not_started", bestPercent: null, lastLocation: "esercizi/1" }),
    ]);

    await saveExerciseWrite(db, user, pick(0));
    expect((await loadProgressSummaries(db, user))[0]).toMatchObject({ status: "in_progress", bestPercent: 14 });

    await db.update(lessonProgress).set({ bestPercent: 57 }).where(eq(lessonProgress.userId, user));
    expect((await saveFinish(db, user, { lessonId: LESSON })).result).toBe("saved");
    const [progress] = await db.select().from(lessonProgress).where(eq(lessonProgress.userId, user));
    expect(progress).toMatchObject({ status: "completed", lastPercent: 14, bestPercent: 57 });
    expect(progress.completedAt).toBeInstanceOf(Date);
  });

  it("Azzera puts the lesson back to not started with every exercise untouched, and keeps the error log", async () => {
    const user = await newUser();
    await saveVisit(db, user, { lessonId: LESSON, location: "esercizi/3" });
    await saveExerciseWrite(db, user, pick(2));
    await saveFinish(db, user, { lessonId: LESSON });

    const response = await saveReset(db, user, { scope: "lesson", lessonId: LESSON, at: "2026-11-20T10:30:00.000Z" }, NOW);
    expect(response).toEqual({ result: "saved", resetAt: NOW.toISOString() });

    expect((await loadLessonEntries(db, user, lesson)).size).toBe(0);
    expect(await db.select().from(itemState).where(eq(itemState.userId, user))).toEqual([]);
    const [progress] = await db.select().from(lessonProgress).where(eq(lessonProgress.userId, user));
    expect(progress).toMatchObject({
      status: "not_started",
      lastLocation: null,
      lastPercent: null,
      bestPercent: null,
      startedAt: null,
      completedAt: null,
    });
    expect(await db.select().from(errorLog).where(eq(errorLog.userId, user))).toHaveLength(1);
    const attempts = await db.select().from(exerciseAttempt).where(eq(exerciseAttempt.userId, user));
    expect(attempts.map(({ action, itemId }) => [action, itemId])).toEqual([
      ["check", I01],
      ["reset", I01],
    ]);

    // A pick made before the reset but synced after it (the other computer) doesn't bring the old state back.
    expect((await saveExerciseWrite(db, user, pick(1, "2026-11-20T10:29:00.000Z"))).result).toBe("ignored");
    expect((await loadLessonEntries(db, user, lesson)).size).toBe(0);

    // Untouched again: a right first Check scores.
    await saveExerciseWrite(db, user, pick(0, "2026-11-20T10:31:00.000Z"));
    expect((await loadLessonEntries(db, user, lesson)).get(I01)?.entry.state).toEqual({
      status: "checked_correct",
      firstCheckCorrect: true,
      points: 1,
    });
  });

  it("Azzera on the level overview resets every lesson of that level and nothing else", async () => {
    const user = await newUser();
    await saveExerciseWrite(db, user, pick(2));
    const elsewhere = { userId: user, lessonId: "b1.u01.l01" };
    await db.insert(itemState).values({ ...elsewhere, itemId: "b1.u01.l01.s01.i01", status: "checked_correct", points: 1, contentHash: "h" });
    await db.insert(lessonProgress).values({ ...elsewhere, contentVersion: 1, status: "in_progress", bestPercent: 50 });

    expect((await saveReset(db, user, { scope: "level", levelId: "a2", at: "2026-11-20T10:30:00.000Z" })).result).toBe("saved");

    const rows = await db.select().from(itemState).where(eq(itemState.userId, user));
    expect(rows.map((row) => row.itemId)).toEqual(["b1.u01.l01.s01.i01"]);
    const progress = await db.select().from(lessonProgress).where(eq(lessonProgress.userId, user));
    expect(Object.fromEntries(progress.map((row) => [row.lessonId, [row.status, row.bestPercent]]))).toEqual({
      [LESSON]: ["not_started", null],
      "b1.u01.l01": ["in_progress", 50],
    });
  });

  it("ignores Azzera for a lesson or level the content doesn't have", async () => {
    const user = await newUser();
    const at = "2026-11-20T10:30:00.000Z";
    expect(await saveReset(db, user, { scope: "lesson", lessonId: "a2.u09.l09", at })).toEqual({ result: "ignored" });
    expect(await saveReset(db, user, { scope: "level", levelId: "c2", at })).toEqual({ result: "ignored" });
  });
});
