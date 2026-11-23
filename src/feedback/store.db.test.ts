/**
 * `npm run test:db`: feedback notes against the Neon `dev` branch (SPEC
 * §10.6). Every test gets its own throwaway profile, deleted with its notes
 * afterwards.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { connect } from "@/db/connect";
import { databaseUrl, loadLocalEnv } from "@/db/env";
import { migrateDatabase } from "@/db/migrate";
import { feedbackNote, profile } from "@/db/schema";
import type { FeedbackWrite } from "./notes";
import { loadOpenNotes, saveFeedbackDone, saveFeedbackNote } from "./store";

loadLocalEnv();
const db = connect(databaseUrl("dev"));
const users: string[] = [];

beforeAll(() => migrateDatabase(db));

afterEach(async () => {
  for (const user of users.splice(0)) {
    await db.delete(feedbackNote).where(eq(feedbackNote.userId, user));
    await db.delete(profile).where(eq(profile.id, user));
  }
});

async function newUser(): Promise<string> {
  const user = randomUUID();
  users.push(user);
  await db.insert(profile).values({ id: user, displayName: "test" });
  return user;
}

const write = (fields: Pick<FeedbackWrite, "scope" | "refId" | "text"> & Partial<FeedbackWrite>): FeedbackWrite => ({
  eventId: randomUUID(),
  at: "2026-11-20T10:00:00.000Z",
  ...fields,
});

describe("saveFeedbackNote and loadOpenNotes", () => {
  it("stores a level note and a lesson note with their scope and ref, as open notes", async () => {
    const user = await newUser();
    const level = write({ scope: "level", refId: "a2", text: "Manca il test finale." });
    const lesson = write({ scope: "lesson", refId: "a2.u01.l02/esercizi/4", text: "Il gap 2 accetta solo «un'».", at: "2026-11-20T11:00:00.000Z" });
    expect(await saveFeedbackNote(db, user, level)).toEqual({ result: "saved" });
    expect(await saveFeedbackNote(db, user, lesson)).toEqual({ result: "saved" });

    const open = await loadOpenNotes(db, user);
    expect(open.map(({ id, scope, refId, text }) => ({ id, scope, refId, text }))).toEqual([
      { id: level.eventId, scope: "level", refId: "a2", text: "Manca il test finale." },
      { id: lesson.eventId, scope: "lesson", refId: "a2.u01.l02/esercizi/4", text: "Il gap 2 accetta solo «un'»." },
    ]);
    expect(open[0].createdAt).toEqual(new Date("2026-11-20T10:00:00.000Z"));
  });

  it("saves a retried write once", async () => {
    const user = await newUser();
    const note = write({ scope: "level", refId: "a2", text: "Una volta sola." });
    await saveFeedbackNote(db, user, note);
    expect(await saveFeedbackNote(db, user, note)).toEqual({ result: "ignored" });
    expect(await loadOpenNotes(db, user)).toHaveLength(1);
  });

  it("ignores a note for a lesson that doesn't exist", async () => {
    const user = await newUser();
    expect(await saveFeedbackNote(db, user, write({ scope: "lesson", refId: "a2.u09.l09/info", text: "x" }))).toEqual({ result: "ignored" });
    expect(await loadOpenNotes(db, user)).toEqual([]);
  });

  it("keeps the server's clock when the computer's is ahead", async () => {
    const user = await newUser();
    const now = new Date("2026-11-23T10:00:00.000Z");
    await saveFeedbackNote(db, user, write({ scope: "level", refId: "a2", text: "x", at: "2030-01-01T00:00:00.000Z" }), now);
    expect((await loadOpenNotes(db, user))[0].createdAt).toEqual(now);
  });
});

describe("saveFeedbackDone (Fatto)", () => {
  it("takes a done note off the open notes, and unticking puts it back", async () => {
    const user = await newUser();
    const note = write({ scope: "lesson", refId: "a2.u01.l01/info", text: "Refuso nel titolo." });
    await saveFeedbackNote(db, user, note);

    expect(await saveFeedbackDone(db, user, { noteId: note.eventId, done: true })).toEqual({ result: "saved" });
    expect(await loadOpenNotes(db, user)).toEqual([]);

    await saveFeedbackDone(db, user, { noteId: note.eventId, done: false });
    expect((await loadOpenNotes(db, user)).map((open) => open.id)).toEqual([note.eventId]);
  });

  it("ignores another profile's note and an unknown one", async () => {
    const user = await newUser();
    const other = await newUser();
    const note = write({ scope: "level", refId: "a2", text: "Mia." });
    await saveFeedbackNote(db, user, note);
    expect(await saveFeedbackDone(db, other, { noteId: note.eventId, done: true })).toEqual({ result: "ignored" });
    expect(await saveFeedbackDone(db, user, { noteId: randomUUID(), done: true })).toEqual({ result: "ignored" });
    expect(await loadOpenNotes(db, user)).toHaveLength(1);
  });
});
