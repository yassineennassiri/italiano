/** Subtitles under the scene: none, Italian, or Italian with English (SPEC §11.3). */
export const SUBTITLE_MODES = ["off", "it", "it_en"] as const;
export type SubtitleMode = (typeof SUBTITLE_MODES)[number];
