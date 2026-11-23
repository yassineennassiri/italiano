import { describe, expect, it, vi } from "vitest";
import { LocalSettings } from "./local";
import { DEFAULT_SETTINGS } from "./settings";

describe("LocalSettings", () => {
  it("has the defaults until the saved settings arrive, then those", () => {
    const local = new LocalSettings();
    expect(local.current()).toEqual(DEFAULT_SETTINGS);
    local.receive({ injectReview: false, subtitles: "it", sceneSpeed: 0.75 });
    expect(local.current()).toEqual({ injectReview: false, subtitles: "it", sceneSpeed: 0.75 });
  });

  it("lets a page's own saved settings stand in until the saved settings arrive, its queued changes over them", () => {
    const local = new LocalSettings();
    const page = { injectReview: false, subtitles: "it" as const, sceneSpeed: 1 as const };
    local.show({ scene_speed: 0.75 });
    expect(local.current(page)).toEqual({ injectReview: false, subtitles: "it", sceneSpeed: 0.75 });
    local.receive(DEFAULT_SETTINGS);
    expect(local.current(page)).toEqual({ ...DEFAULT_SETTINGS, sceneSpeed: 0.75 });
  });

  it("shows a queued change at once, the latest change winning, and tells its subscribers", () => {
    const local = new LocalSettings();
    const listener = vi.fn();
    local.subscribe(listener);
    local.show({ subtitles: "it" });
    local.show({ subtitles: "it_en", scene_speed: 0.75 });
    expect(local.current()).toEqual({ injectReview: true, subtitles: "it_en", sceneSpeed: 0.75 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("keeps showing a change over saved settings that arrive before it lands", () => {
    const local = new LocalSettings();
    local.show({ inject_review: false });
    local.receive({ ...DEFAULT_SETTINGS, subtitles: "it" });
    expect(local.current()).toEqual({ injectReview: false, subtitles: "it", sceneSpeed: 1 });
  });

  it("keeps a landed change, since the server now has it", () => {
    const local = new LocalSettings();
    const write = { scene_speed: 0.75 as const };
    local.show(write);
    local.landed(write, { result: "saved" });
    expect(local.current().sceneSpeed).toBe(0.75);
    // The other computer changed it since: the newer saved settings count.
    local.receive(DEFAULT_SETTINGS);
    expect(local.current().sceneSpeed).toBe(1);
  });

  it("drops a rejected change", () => {
    const local = new LocalSettings();
    const write = { subtitles: "it" as const };
    local.show(write);
    local.landed(write, { result: "rejected" });
    expect(local.current().subtitles).toBe("off");
  });

  it("lays a change restored after a reload under the changes made in this tab", () => {
    const local = new LocalSettings();
    local.show({ subtitles: "it_en" });
    local.restore({ subtitles: "it", scene_speed: 0.75 });
    expect(local.current()).toEqual({ injectReview: true, subtitles: "it_en", sceneSpeed: 0.75 });
  });
});
