/**
 * The synced settings (SPEC §10.1): kept in `profile.settings`, so both
 * computers share them. The Italian voice is not one of them: each computer
 * keeps its own (`AudioService`). Pure: no React, no Next.js.
 */
import { z } from "zod";
import type { Rate } from "@/audio/audio-service";
import { SUBTITLE_MODES, type SubtitleMode } from "@/audio/subtitles";

export type Settings = {
  /** *Ripasso personale*: whether lessons get the step (ADR-0005). */
  injectReview: boolean;
  /** The subtitles a scene player opens with. */
  subtitles: SubtitleMode;
  /** The speed a scene player opens with. */
  sceneSpeed: Rate;
};

export const DEFAULT_SETTINGS: Settings = { injectReview: true, subtitles: "off", sceneSpeed: 1 };

const injectReview = z.boolean();
const subtitles = z.enum(SUBTITLE_MODES);
const sceneSpeed = z.union([z.literal(1), z.literal(0.75)]);

/** The stored settings with their defaults: a missing or unknown value falls back on its own. */
export function parseSettings(stored: Readonly<Record<string, unknown>> | undefined): Settings {
  const read = <T>(schema: z.ZodType<T>, value: unknown, fallback: T): T => {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : fallback;
  };
  return {
    injectReview: read(injectReview, stored?.inject_review, DEFAULT_SETTINGS.injectReview),
    subtitles: read(subtitles, stored?.subtitles, DEFAULT_SETTINGS.subtitles),
    sceneSpeed: read(sceneSpeed, stored?.scene_speed, DEFAULT_SETTINGS.sceneSpeed),
  };
}

/**
 * A change to some of the settings, with their `profile.settings` keys. Only
 * the keys it names are written, so a change made on one computer doesn't
 * undo another setting changed on the other.
 */
export const settingsWriteSchema = z
  .strictObject({ inject_review: injectReview, subtitles, scene_speed: sceneSpeed })
  .partial()
  .refine((write) => Object.keys(write).length > 0, "changes nothing");
export type SettingsWrite = z.infer<typeof settingsWriteSchema>;

/** The settings once a write is applied to them. */
export function withWrite(settings: Settings, write: SettingsWrite): Settings {
  return {
    injectReview: write.inject_review ?? settings.injectReview,
    subtitles: write.subtitles ?? settings.subtitles,
    sceneSpeed: write.scene_speed ?? settings.sceneSpeed,
  };
}
