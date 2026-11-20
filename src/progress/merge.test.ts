import { describe, expect, it } from "vitest";
import type { ExerciseEntry } from "@/items/entry";
import { NEW_ENTRY } from "@/items/entry";
import { currentEntry, settleLocal } from "./merge";

const wrong: ExerciseEntry = { state: { status: "checked_wrong", firstCheckCorrect: false, points: 0 }, answer: { picks: [2] } };
const right: ExerciseEntry = { state: { status: "checked_correct", firstCheckCorrect: false, points: 0 }, answer: { picks: [2, 0] } };

describe("currentEntry", () => {
  it("shows the page's saved entry when this tab changed nothing, else a new one", () => {
    expect(currentEntry(undefined, { entry: wrong, savedAt: "2026-11-20T10:00:00.000Z" })).toBe(wrong);
    expect(currentEntry(undefined, undefined)).toBe(NEW_ENTRY);
  });

  it("shows this tab's change while its write is still on the way", () => {
    const local = { entry: right, pending: 1, savedAt: null };
    expect(currentEntry(local, { entry: wrong, savedAt: "2026-11-20T11:00:00.000Z" })).toBe(right);
  });

  it("once confirmed, shows whichever state was saved last: latest state wins", () => {
    const local = { entry: right, pending: 0, savedAt: "2026-11-20T10:05:00.000Z" };
    expect(currentEntry(local, { entry: wrong, savedAt: "2026-11-20T10:00:00.000Z" })).toBe(right);
    expect(currentEntry(local, { entry: wrong, savedAt: "2026-11-20T10:09:00.000Z" })).toBe(wrong);
  });
});

describe("settleLocal", () => {
  it("adopts the server's entry when this exercise's last write lands", () => {
    const local = { entry: right, pending: 1, savedAt: null };
    const saved = { entry: wrong, savedAt: "2026-11-20T10:05:00.000Z" };
    expect(settleLocal(local, saved)).toEqual({ entry: wrong, pending: 0, savedAt: "2026-11-20T10:05:00.000Z" });
  });

  it("keeps the newer local entry while later writes are still on the way", () => {
    const local = { entry: right, pending: 2, savedAt: null };
    const saved = { entry: wrong, savedAt: "2026-11-20T10:05:00.000Z" };
    expect(settleLocal(local, saved)).toEqual({ entry: right, pending: 1, savedAt: "2026-11-20T10:05:00.000Z" });
  });

  it("forgets the local entry when the server kept nothing for it, so the page's state shows again", () => {
    expect(settleLocal({ entry: right, pending: 1, savedAt: null }, undefined)).toBeUndefined();
  });
});
