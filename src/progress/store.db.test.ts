/**
 * `npm run test:db`: the progress round trip against the Neon `dev` branch.
 * Each run uses its own throwaway profile and deletes its rows afterwards.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { connect } from "@/db/connect";
import { databaseUrl, loadLocalEnv } from "@/db/env";
import { migrateDatabase } from "@/db/migrate";
import { errorLog, exerciseAttempt, itemState, lessonProgress, profile } from "@/db/schema";
import { loadLessonEntries, loadLastLocation, saveExerciseWrite, saveVisit } from "./store";

loadLocalEnv();
const db = connect(databaseUrl("dev"));
const USER = randomUUID();
const LESSON = "a2.u01.l01";
const I01 = "a2.u01.l01.s01.i01";
const lesson = loadLesson(LESSON)!;

beforeAll(async () => {
  await migrateDatabase(db);
  await db.insert(profile).values({ id: USER, displayName: "test" });
});

afterAll(async () => {
  for (const table of [itemState, exerciseAttempt, errorLog, lessonProgress]) await db.delete(table).where(eq(table.userId, USER));
  await db.delete(profile).where(eq(profile.id, USER));
});

describe("progress store", () => {
  it("saves a wrong first Check and restores it on the next load", async () => {
    const write = { eventId: randomUUID(), lessonId: LESSON, exerciseId: I01, kind: "pick", option: 2 } as const;
    expect(await saveExerciseWrite(db, USER, write)).toBe("saved");

    expect((await loadLessonEntries(db, USER, lesson)).get(I01)).toEqual({
      state: { status: "checked_wrong", firstCheckCorrect: false, points: 0 },
      answer: { picks: [2] },
    });
    const errors = await db.select().from(errorLog).where(eq(errorLog.userId, USER));
    expect(errors).toMatchObject([{ source: "exercise", itemId: I01, expected: "La padrona di casa", given: "Nessuno" }]);
    const [progress] = await db.select().from(lessonProgress).where(eq(lessonProgress.userId, USER));
    expect(progress).toMatchObject({ status: "in_progress", lastPercent: 0, contentVersion: 1 });
  });

  it("applies a retried write only once", async () => {
    const write = { eventId: randomUUID(), lessonId: LESSON, exerciseId: I01, kind: "pick", option: 1 } as const;
    expect(await saveExerciseWrite(db, USER, write)).toBe("saved");
    expect(await saveExerciseWrite(db, USER, write)).toBe("ignored");

    const attempts = await db.select().from(exerciseAttempt).where(eq(exerciseAttempt.userId, USER));
    expect(attempts).toHaveLength(2);
    expect((await loadLessonEntries(db, USER, lesson)).get(I01)?.answer).toEqual({ picks: [2, 1] });
  });

  it("ignores a stored state once its item's content has changed", async () => {
    await db.update(itemState).set({ contentHash: "content-before-an-edit" }).where(eq(itemState.userId, USER));
    expect((await loadLessonEntries(db, USER, lesson)).has(I01)).toBe(false);
  });

  it("remembers the last visited step", async () => {
    expect(await loadLastLocation(db, USER, LESSON)).toBeNull();
    await saveVisit(db, USER, { lessonId: LESSON, location: "esercizi/2" });
    await saveVisit(db, USER, { lessonId: LESSON, location: "esercizi/4" });
    expect(await loadLastLocation(db, USER, LESSON)).toBe("esercizi/4");
  });
});
