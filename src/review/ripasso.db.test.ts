/**
 * `npm run test:db`: the Ripasso personale step against the Neon `dev` branch
 * (SPEC §10.5, ADR-0005). Every test gets its own throwaway profile, deleted
 * with its rows afterwards.
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { exerciseHashes } from "@/content/hash";
import { loadLesson } from "@/content/load";
import { connect } from "@/db/connect";
import { databaseUrl, loadLocalEnv } from "@/db/env";
import { migrateDatabase } from "@/db/migrate";
import { errorLog, exerciseAttempt, itemState, lessonProgress, profile, reviewCard, reviewLog } from "@/db/schema";
import { saveFinish, saveReset } from "@/progress/store";
import type { ReviewWrite } from "./plan";
import { loadRipassoCards, loadRipassoChoice, loadStoredRipasso, saveReviewWrite } from "./store";

loadLocalEnv();
const db = connect(databaseUrl("dev"));
const lesson = loadLesson("a2.u01.l02")!;
const L1_HASHES = exerciseHashes(loadLesson("a2.u01.l01")!);
// Due item cards from lesson 1: the first shares article.lo with lesson 2, the others share no tag.
const L1_LO = "a2.u01.l01.s02.i01";
const L1_GLI = "a2.u01.l01.s03.i01";
const L1_PICK = "a2.u01.l01.s01.i01";
const L1_PREP = "a2.u01.l01.s04.i02";
const NOW = new Date("2026-11-20T10:00:00.000Z");
const users: string[] = [];

beforeAll(() => migrateDatabase(db));

afterEach(async () => {
  for (const user of users.splice(0)) {
    for (const table of [itemState, exerciseAttempt, errorLog, lessonProgress, reviewLog, reviewCard]) await db.delete(table).where(eq(table.userId, user));
    await db.delete(profile).where(eq(profile.id, user));
  }
});

async function newUser(settings: Record<string, unknown> = {}): Promise<string> {
  const user = randomUUID();
  users.push(user);
  await db.insert(profile).values({ id: user, displayName: "test", settings });
  return user;
}

/** An item card for the exercise, due `daysAgo` days before NOW; returns its id. */
async function dueCard(user: string, refId: string, daysAgo: number): Promise<string> {
  const id = randomUUID();
  const dueAt = new Date(NOW.getTime() - daysAgo * 86_400_000);
  await db.insert(reviewCard).values({ id, userId: user, kind: "item", refId, dueAt, intervalDays: 1, ease: 2.5 });
  return id;
}

const storedChoice = async (user: string) =>
  (
    await db
      .select({ reviewItems: lessonProgress.reviewItems })
      .from(lessonProgress)
      .where(and(eq(lessonProgress.userId, user), eq(lessonProgress.lessonId, lesson.id)))
  )[0]?.reviewItems;

describe("loadRipassoChoice", () => {
  it("chooses up to 3 due item cards on the first visit, tag overlap first, and stores them", async () => {
    const user = await newUser();
    await dueCard(user, L1_GLI, 3);
    await dueCard(user, L1_PICK, 2);
    await dueCard(user, L1_LO, 1);
    await dueCard(user, L1_PREP, 0.5);

    expect((await loadRipassoChoice(db, user, lesson, NOW)).items).toEqual([L1_LO, L1_GLI, L1_PICK]);
    expect(await storedChoice(user)).toEqual([L1_LO, L1_GLI, L1_PICK]);
  });

  it("keeps the stored choice on every later visit, even when other cards fall due", async () => {
    const user = await newUser();
    await dueCard(user, L1_GLI, 1);
    const first = await loadRipassoChoice(db, user, lesson, NOW);
    await dueCard(user, L1_LO, 2);

    const later = await loadRipassoChoice(db, user, lesson, new Date(NOW.getTime() + 3_600_000));
    expect(later).toEqual(first);
    expect(later.items).toEqual([L1_GLI]);
  });

  it("has no step when no item card is due, and keeps none when one falls due later in the visit", async () => {
    const user = await newUser();
    expect((await loadRipassoChoice(db, user, lesson, NOW)).items).toEqual([]);
    expect(await storedChoice(user)).toEqual([]);
    await dueCard(user, L1_LO, 1);
    expect((await loadRipassoChoice(db, user, lesson, NOW)).items).toEqual([]);
  });

  it("has no step, and chooses nothing, with inject_review off", async () => {
    const user = await newUser({ inject_review: false });
    await dueCard(user, L1_LO, 1);
    expect((await loadRipassoChoice(db, user, lesson, NOW)).items).toEqual([]);
    expect(await storedChoice(user)).toBeUndefined();
  });

  it("is cleared by Finish and by Azzera, so the next visit chooses again", async () => {
    const user = await newUser();
    await dueCard(user, L1_LO, 1);
    await loadRipassoChoice(db, user, lesson, NOW);
    await saveFinish(db, user, { lessonId: lesson.id }, NOW);
    expect(await storedChoice(user)).toBeNull();

    await loadRipassoChoice(db, user, lesson, NOW);
    expect(await storedChoice(user)).toEqual([L1_LO]);
    await saveReset(db, user, { scope: "lesson", lessonId: lesson.id, at: NOW.toISOString() }, NOW);
    expect(await storedChoice(user)).toBeNull();
  });
});

describe("loadStoredRipasso (the Results page)", () => {
  it("reads the stored choice without ever choosing, so a Results reload after Finish adds no step", async () => {
    const user = await newUser();
    await dueCard(user, L1_LO, 1);
    expect(await loadStoredRipasso(db, user, lesson.id)).toEqual({ items: [], chosenAt: null });
    expect(await storedChoice(user)).toBeUndefined();

    await loadRipassoChoice(db, user, lesson, NOW);
    expect((await loadStoredRipasso(db, user, lesson.id)).items).toEqual([L1_LO]);
  });
});

describe("a Ripasso personale answer", () => {
  it("grades its card with source ripasso_personale, leaves item_state alone, and shows again on the next load", async () => {
    const user = await newUser();
    const cardId = await dueCard(user, L1_PICK, 1);
    const choice = await loadRipassoChoice(db, user, lesson, NOW);
    expect(await loadRipassoCards(db, user, choice)).toEqual([{ exerciseId: L1_PICK, cardId }]);

    const answer: ReviewWrite = {
      eventId: randomUUID(),
      cardId,
      exerciseId: L1_PICK,
      contentHash: L1_HASHES.get(L1_PICK)!,
      at: new Date(NOW.getTime() + 60_000).toISOString(),
      source: "ripasso_personale",
      kind: "pick",
      option: 0,
    };
    const later = new Date(NOW.getTime() + 60_000);
    expect(await saveReviewWrite(db, user, answer, later)).toEqual({ result: "saved" });

    expect(await db.select().from(reviewLog).where(eq(reviewLog.userId, user))).toMatchObject([{ cardId, grade: "good", source: "ripasso_personale" }]);
    expect(await db.select().from(itemState).where(eq(itemState.userId, user))).toEqual([]);
    expect(await loadRipassoCards(db, user, choice)).toEqual([
      { exerciseId: L1_PICK, cardId, answer: { answer: { picks: [0] }, correct: true } },
    ]);
  });

  it("answers from before this visit's choice, or from a review session, don't show as given", async () => {
    const user = await newUser();
    const cardId = await dueCard(user, L1_PICK, 1);
    const before = { eventId: randomUUID(), cardId, exerciseId: L1_PICK, contentHash: L1_HASHES.get(L1_PICK)!, kind: "pick", option: 0 } as const;
    // An earlier visit's answer: the card is due again at the earliest the next midnight, hours later.
    const earlier = new Date(NOW.getTime() - 3 * 3_600_000);
    await saveReviewWrite(db, user, { ...before, at: earlier.toISOString(), source: "ripasso_personale" }, earlier);
    await db.update(reviewCard).set({ dueAt: NOW }).where(eq(reviewCard.id, cardId));

    const choice = await loadRipassoChoice(db, user, lesson, new Date(NOW.getTime() + 60_000));
    const hub = new Date(NOW.getTime() + 120_000);
    await saveReviewWrite(db, user, { ...before, eventId: randomUUID(), at: hub.toISOString(), source: "hub" }, hub);
    expect(await loadRipassoCards(db, user, choice)).toEqual([{ exerciseId: L1_PICK, cardId }]);
  });
});
