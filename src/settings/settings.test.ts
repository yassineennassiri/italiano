import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings, settingsWriteSchema } from "./settings";

describe("parseSettings (SPEC §10.1)", () => {
  it("gives the defaults for an empty profile: Ripasso personale on, no subtitles, 1×", () => {
    expect(parseSettings({})).toEqual({ injectReview: true, subtitles: "off", sceneSpeed: 1 });
    expect(DEFAULT_SETTINGS).toEqual({ injectReview: true, subtitles: "off", sceneSpeed: 1 });
  });

  it("reads the stored values", () => {
    expect(parseSettings({ inject_review: false, subtitles: "it_en", scene_speed: 0.75 })).toEqual({
      injectReview: false,
      subtitles: "it_en",
      sceneSpeed: 0.75,
    });
  });

  it("falls back to each default on its own when a value is not one it knows", () => {
    expect(parseSettings({ inject_review: "no", subtitles: "de", scene_speed: 2, other: 1 })).toEqual({
      injectReview: true,
      subtitles: "off",
      sceneSpeed: 1,
    });
    expect(parseSettings({ subtitles: "it", scene_speed: "0.75" })).toEqual({ injectReview: true, subtitles: "it", sceneSpeed: 1 });
  });
});

describe("settingsWriteSchema", () => {
  it("accepts a change to one or more of the synced settings", () => {
    expect(settingsWriteSchema.parse({ inject_review: false })).toEqual({ inject_review: false });
    expect(settingsWriteSchema.parse({ subtitles: "it", scene_speed: 0.75 })).toEqual({ subtitles: "it", scene_speed: 0.75 });
  });

  it("rejects an empty change, an unknown setting and a value out of range", () => {
    expect(settingsWriteSchema.safeParse({}).success).toBe(false);
    expect(settingsWriteSchema.safeParse({ voice: "Elsa" }).success).toBe(false);
    expect(settingsWriteSchema.safeParse({ scene_speed: 0.5 }).success).toBe(false);
    expect(settingsWriteSchema.safeParse({ subtitles: "en" }).success).toBe(false);
  });
});
