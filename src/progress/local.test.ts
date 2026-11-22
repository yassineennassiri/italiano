import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import type { ExerciseEntry } from "@/items/entry";
import { openIndexedDbStore } from "./indexed-db-store";
import { LocalProgress, type ProgressResponse, type ProgressWrite } from "./local";
import type { SavedEntry } from "./merge";
import type { ExerciseWrite } from "./plan";
import { WriteQueue } from "./write-queue";

const LESSON = "a2.u01.l01";
const I01 = `${LESSON}.s01.i01`;
const I02 = `${LESSON}.s01.i02`;

const wrong: ExerciseEntry = { state: { status: "checked_wrong", firstCheckCorrect: false, points: 0 }, answer: { picks: [0] } };
const right: ExerciseEntry = { state: { status: "checked_correct", firstCheckCorrect: true, points: 1 }, answer: { picks: [1] } };
const reopened: ExerciseEntry = { state: { status: "untouched", firstCheckCorrect: false, points: 0 }, answer: null };

/** The entry the server sent with the page, saved before this visit. */
const pageSaved: SavedEntry = { entry: wrong, savedAt: "2026-11-22T09:00:00.000Z" };

function exerciseWrite(exerciseId: string, entry: ExerciseEntry, eventId = crypto.randomUUID()): ProgressWrite {
  const exercise: ExerciseWrite = {
    eventId,
    lessonId: LESSON,
    exerciseId,
    contentHash: "hash",
    at: "2026-11-22T10:00:00.000Z",
    kind: "check",
    answer: entry.answer,
  };
  return { type: "exercise", exercise, entry };
}

describe("LocalProgress", () => {
  it("shows a change at once, then the server's saved entry once its write is answered", () => {
    const progress = new LocalProgress();
    const write = exerciseWrite(I01, right);
    progress.show(write);
    expect(progress.entryOf(I01, pageSaved)).toEqual(right);

    const answered = { entry: { ...right, answer: { picks: [1], saved: true } }, savedAt: "2026-11-22T10:00:01.000Z" };
    progress.landed(write, { result: "saved", saved: answered });
    expect(progress.entryOf(I01, pageSaved)).toEqual(answered.entry);
  });

  it("forgets a change the server rejected, showing the page's entry again", () => {
    const progress = new LocalProgress();
    const write = exerciseWrite(I01, right);
    progress.show(write);
    progress.landed(write, { result: "rejected" });
    expect(progress.entryOf(I01, pageSaved)).toEqual(wrong);
  });

  it("keeps showing a change while a later write for the same exercise is on the way", () => {
    const progress = new LocalProgress();
    const first = exerciseWrite(I01, wrong);
    const second = exerciseWrite(I01, right);
    progress.show(first);
    progress.show(second);
    progress.landed(first, { result: "saved", saved: { entry: wrong, savedAt: "2026-11-22T10:00:01.000Z" } });
    expect(progress.entryOf(I01, undefined)).toEqual(right);
  });

  it("reopens exercises for Correggi i miei errori until the server answers with them reopened", () => {
    const progress = new LocalProgress();
    const write: ProgressWrite = {
      type: "correction",
      correction: { lessonId: LESSON, at: "2026-11-22T10:00:00.000Z" },
      reopened: { [I01]: reopened },
    };
    progress.show(write);
    expect(progress.entryOf(I01, pageSaved)).toEqual(reopened);
    progress.landed(write, { result: "saved", saved: { [I01]: { entry: reopened, savedAt: "2026-11-22T10:00:01.000Z" } } });
    expect(progress.entryOf(I01, pageSaved)).toEqual(reopened);
  });

  it("hides the saved entries an Azzera covers, and shows them again if the server ignored it", () => {
    const progress = new LocalProgress();
    const write: ProgressWrite = { type: "reset", reset: { scope: "lesson", lessonId: LESSON, at: "2026-11-22T10:00:00.000Z" } };
    progress.show(write);
    expect(progress.entryOf(I01, pageSaved).state.status).toBe("untouched");
    progress.landed(write, { result: "ignored" });
    expect(progress.entryOf(I01, pageSaved)).toEqual(wrong);
  });

  it("keeps an answer given while the stored writes were still being read, over the older stored one", () => {
    const progress = new LocalProgress();
    const fresh = exerciseWrite(I01, right);
    const stored = exerciseWrite(I01, wrong);
    progress.show(fresh);
    progress.restore(stored);
    expect(progress.entryOf(I01, undefined)).toEqual(right);

    // Both writes are on the way: the answer shows until the last one is answered.
    progress.landed(stored, { result: "saved", saved: { entry: wrong, savedAt: "2026-11-22T10:00:01.000Z" } });
    expect(progress.entryOf(I01, undefined)).toEqual(right);
    progress.landed(fresh, { result: "saved", saved: { entry: right, savedAt: "2026-11-22T10:00:02.000Z" } });
    expect(progress.entryOf(I01, undefined)).toEqual(right);
  });

  it("a restored Azzera doesn't hide an answer given since the reload", () => {
    const progress = new LocalProgress();
    progress.show(exerciseWrite(I01, right));
    progress.restore({ type: "reset", reset: { scope: "lesson", lessonId: LESSON, at: "2026-11-22T09:30:00.000Z" } });
    expect(progress.entryOf(I01, pageSaved)).toEqual(right);
    expect(progress.entryOf(I02, pageSaved).state.status).toBe("untouched");
  });

  it("tells subscribers about every change", () => {
    const progress = new LocalProgress();
    let calls = 0;
    progress.subscribe(() => calls++);
    const before = progress.version;
    const write = exerciseWrite(I01, right);
    progress.show(write);
    progress.landed(write, { result: "ignored" });
    expect(calls).toBe(2);
    expect(progress.version).not.toBe(before);
  });
});

/** One visit to the app: its local progress and its queue on the browser's IndexedDB. */
function visit(browser: IDBFactory, send: (write: ProgressWrite) => Promise<ProgressResponse>) {
  const progress = new LocalProgress();
  const queue = new WriteQueue<ProgressWrite, ProgressResponse>({
    send,
    landed: (write, response) => progress.landed(write, response),
    restore: (write) => progress.restore(write),
    store: openIndexedDbStore(browser),
  });
  /** Like `submitAction`: shows the change, then queues its write. */
  const submit = (write: ProgressWrite) => {
    progress.show(write);
    queue.enqueue(write);
  };
  return { progress, queue, submit };
}

/** Resolves once `check` passes, polling: IndexedDB works on real timers. */
async function eventually(check: () => void): Promise<void> {
  for (let tries = 0; ; tries++) {
    try {
      return check();
    } catch (error) {
      if (tries > 100) throw error;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
}

describe("a reload while offline (IndexedDB)", () => {
  it("shows the unsent answers over the server's entries, replays them in order, then shows what the server saved", async () => {
    const browser = new IDBFactory();
    let online = false;
    const received: string[] = [];
    const send = async (write: ProgressWrite): Promise<ProgressResponse> => {
      if (!online) throw new Error("fetch failed");
      if (write.type !== "exercise") return { result: "saved" };
      received.push(write.exercise.eventId);
      return { result: "saved", saved: { entry: write.entry, savedAt: "2026-11-22T11:00:00.000Z" } };
    };

    const before = visit(browser, send);
    const first = exerciseWrite(I01, right, "00000000-0000-4000-8000-000000000001");
    const second = exerciseWrite(I02, wrong, "00000000-0000-4000-8000-000000000002");
    before.submit(first);
    before.submit(second);
    await eventually(() => expect(before.queue.status).toBe("stored"));
    before.queue.close();

    // The reload: the page brings the server's old entries, the stored answers go over them.
    const after = visit(browser, send);
    await eventually(() => expect(after.progress.entryOf(I01, pageSaved)).toEqual(right));
    expect(after.progress.entryOf(I02, undefined)).toEqual(wrong);
    await eventually(() => expect(after.queue.status).toBe("stored"));

    online = true;
    after.queue.online();
    await eventually(() => expect(after.queue.status).toBe("saved"));
    // Each write once, with the eventId it was made with: the server can't record it twice.
    expect(received).toEqual(["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"]);
    const savedNow: SavedEntry = { entry: right, savedAt: "2026-11-22T11:00:00.000Z" };
    expect(after.progress.entryOf(I01, pageSaved)).toEqual(savedNow.entry);

    // Nothing is left to replay on the next visit.
    const next = visit(browser, send);
    await eventually(() => expect(next.queue.status).toBe("saved"));
    expect(received).toHaveLength(2);
  });

  it("keeps an unsent Azzera across the reload: the saved entries stay hidden until it lands", async () => {
    const browser = new IDBFactory();
    let online = false;
    const send = async (write: ProgressWrite): Promise<ProgressResponse> => {
      if (!online) throw new Error("fetch failed");
      return write.type === "reset" ? { result: "saved", resetAt: "2026-11-22T11:00:00.000Z" } : { result: "saved" };
    };
    const before = visit(browser, send);
    before.submit({ type: "reset", reset: { scope: "lesson", lessonId: LESSON, at: "2026-11-22T10:00:00.000Z" } });
    await eventually(() => expect(before.queue.status).toBe("stored"));
    before.queue.close();

    const after = visit(browser, send);
    await eventually(() => expect(after.progress.entryOf(I01, pageSaved).state.status).toBe("untouched"));
    online = true;
    after.queue.online();
    await eventually(() => expect(after.queue.status).toBe("saved"));
    // Saved before the reset landed: still hidden.
    expect(after.progress.entryOf(I01, pageSaved).state.status).toBe("untouched");
  });
});
