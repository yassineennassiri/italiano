/**
 * The scene player's timing without audio files (SPEC §11.3, fallback mode):
 * estimated line and scene durations, and which panel shows at each line.
 * Pure: the scene player and the audio service share it.
 */
import type { Scene, ScriptLine } from "@/content/schema";
import { plainVocabLinks } from "@/content/vocab-links";

/** Roughly how fast an Italian voice reads at 1×. */
export const CHARS_PER_SECOND = 14;
/** The pause between two lines (SPEC §11.1: line clips joined with ~400 ms gaps). */
export const LINE_GAP_S = 0.4;
/** Even "Sì." takes a moment. */
export const MIN_LINE_S = 1;

/** How long a line takes to say at `rate` (1 = normal, 0.75 = slower); vocab links count as their words. */
export function estimateLineSeconds(text: string, rate = 1): number {
  return Math.max(MIN_LINE_S, plainVocabLinks(text).length / CHARS_PER_SECOND / rate);
}

/** How long the scene takes: every line, with a gap between each two. */
export function estimateSceneSeconds(lines: readonly Pick<ScriptLine, "it">[], rate = 1): number {
  const speaking = lines.reduce((total, line) => total + estimateLineSeconds(line.it, rate), 0);
  return speaking + LINE_GAP_S * Math.max(0, lines.length - 1);
}

/** The panel showing while line `lineIndex` plays: the last one whose `from_line` has started (the first before any). */
export function panelIndexAt(scene: Pick<Scene, "panels" | "lines">, lineIndex: number): number {
  let shown = 0;
  scene.panels.forEach((panel, index) => {
    const from = scene.lines.findIndex((line) => line.id === panel.from_line);
    if (from !== -1 && from <= lineIndex) shown = index;
  });
  return shown;
}
