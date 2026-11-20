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
import { errorLog, exerciseAttempt, itemState, lessonProgress, profile } from "@/db/schema";
import type { ExerciseWrite } from "./plan";
import { loadLastLocation, loadLessonEntries, saveExerciseWrite, saveVisit } from "./store";

loadLocalEnv();
const db = connect(databaseUrl("dev"));
const LESSON = "a2.u01.l01";
const I01 = "a2.u01.l01.s01.i01";
const lesson = loadLesson(LESSON)!;
const HASH = exerciseHashes(lesson).get(I01)!;
const users: string[] = [];

beforeAll(() => migrateDatabase(db));

afterEach(async () => {
  for (const user of users.splice(0)) {
    for (const table of [itemState, exerciseAttempt, errorLog, lessonProgress]) await db.delete(table).where(eq(table.userId, user));
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
});
