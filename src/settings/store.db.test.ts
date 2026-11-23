/**
 * `npm run test:db`: the synced settings against the Neon `dev` branch
 * (SPEC §10.1). Every test gets its own throwaway profile, deleted with its
 * rows afterwards.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { connect } from "@/db/connect";
import { databaseUrl, loadLocalEnv } from "@/db/env";
import { migrateDatabase } from "@/db/migrate";
import { lessonProgress, profile, reviewCard } from "@/db/schema";
import { loadRipassoChoice, loadStoredRipasso } from "@/review/store";
import { loadSettings, saveSettings } from "./store";

loadLocalEnv();
const db = connect(databaseUrl("dev"));
const lesson = loadLesson("a2.u01.l02")!;
const L1_LO = "a2.u01.l01.s02.i01";
const NOW = new Date("2026-11-20T10:00:00.000Z");
const users: string[] = [];

beforeAll(() => migrateDatabase(db));

afterEach(async () => {
  for (const user of users.splice(0)) {
    for (const table of [lessonProgress, reviewCard]) await db.delete(table).where(eq(table.userId, user));
    await db.delete(profile).where(eq(profile.id, user));
  }
});

async function newUser(settings: Record<string, unknown> = {}): Promise<string> {
  const user = randomUUID();
  users.push(user);
  await db.insert(profile).values({ id: user, displayName: "test", settings });
  return user;
}

describe("saveSettings and loadSettings", () => {
  it("reads the defaults from a profile with no settings", async () => {
    const user = await newUser();
    expect(await loadSettings(db, user)).toEqual({ injectReview: true, subtitles: "off", sceneSpeed: 1 });
  });

  it("writes only the settings a change names, keeping the others and any other key", async () => {
    const user = await newUser({ subtitles: "it", recording: true });
    expect(await saveSettings(db, user, { scene_speed: 0.75 })).toEqual({ result: "saved" });
    expect(await saveSettings(db, user, { inject_review: false })).toEqual({ result: "saved" });

    expect(await loadSettings(db, user)).toEqual({ injectReview: false, subtitles: "it", sceneSpeed: 0.75 });
    const [row] = await db.select({ settings: profile.settings }).from(profile).where(eq(profile.id, user));
    expect(row.settings).toEqual({ subtitles: "it", recording: true, scene_speed: 0.75, inject_review: false });
  });
});

describe("Ripasso personale on/off (SPEC §10.1, ADR-0005)", () => {
  it("turning it off removes the step even where it was chosen; turning it on brings it back", async () => {
    const user = await newUser();
    await db.insert(reviewCard).values({
      id: randomUUID(),
      userId: user,
      kind: "item",
      refId: L1_LO,
      dueAt: new Date(NOW.getTime() - 86_400_000),
      intervalDays: 1,
      ease: 2.5,
    });
    expect((await loadRipassoChoice(db, user, lesson, NOW)).items).toEqual([L1_LO]);

    await saveSettings(db, user, { inject_review: false });
    expect((await loadRipassoChoice(db, user, lesson, NOW)).items).toEqual([]);
    expect((await loadStoredRipasso(db, user, lesson.id)).items).toEqual([]);

    await saveSettings(db, user, { inject_review: true });
    expect((await loadRipassoChoice(db, user, lesson, NOW)).items).toEqual([L1_LO]);
    expect((await loadStoredRipasso(db, user, lesson.id)).items).toEqual([L1_LO]);
  });
});
