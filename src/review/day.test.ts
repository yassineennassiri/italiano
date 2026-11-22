import { describe, expect, it } from "vitest";
import { dueAt } from "./day";

describe("dueAt", () => {
  it("is midnight in Genoa the given number of days later, whatever the hour of the review", () => {
    // 23:30 in Genoa on 20 November: tomorrow starts half an hour later.
    expect(dueAt(new Date("2026-11-20T22:30:00Z"), 1).toISOString()).toBe("2026-11-20T23:00:00.000Z");
    // 08:00 in Genoa on 20 November.
    expect(dueAt(new Date("2026-11-20T07:00:00Z"), 1).toISOString()).toBe("2026-11-20T23:00:00.000Z");
    expect(dueAt(new Date("2026-11-20T07:00:00Z"), 6).toISOString()).toBe("2026-11-25T23:00:00.000Z");
  });

  it("follows the clocks across summer time", () => {
    // Summer time starts on 29 March 2026: midnight on 30 March is 22:00 UTC.
    expect(dueAt(new Date("2026-03-28T12:00:00Z"), 1).toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(dueAt(new Date("2026-03-28T12:00:00Z"), 2).toISOString()).toBe("2026-03-29T22:00:00.000Z");
  });
});
