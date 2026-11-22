"use client";

import { useEffect, useState } from "react";
import { audioService, type Rate } from "@/audio/audio-service";
import { LINE_GAP_S } from "@/audio/scene-timeline";
import type { ScriptLine } from "@/content/schema";

/** A line to play: its Italian text and, once generated, its MP3. */
export type PlaybackLine = Pick<ScriptLine, "it" | "audio">;

/**
 * Plays lines one by one through the audio service, with the scene's short gap
 * between them (SPEC §11.1, §11.3), for the scene player and the clip player.
 * It stops after the last line, and when another clip (a 🔊 button) takes
 * over. `key` names the lines while they play; `silentFallback` waits a line's
 * estimated time when it can't be heard instead of stopping.
 */
export function useLinePlayback(lines: readonly PlaybackLine[], { key, rate = 1, silentFallback = false }: { key: string; rate?: Rate; silentFallback?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [line, setLine] = useState(0);

  // Say the current line; when it ends, pause briefly and move on, or stop after the last.
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    let gap: ReturnType<typeof setTimeout> | undefined;
    const service = audioService();
    const { it, audio } = lines[line];
    void service.play({ text: it, audio }, { rate, key, silentFallback }).then((result) => {
      if (cancelled) return;
      if (result !== "ended") return setPlaying(false); // Stopped, taken over, or not heard.
      if (line + 1 >= lines.length) {
        setPlaying(false);
        setFinished(true);
        return;
      }
      gap = setTimeout(() => setLine(line + 1), LINE_GAP_S * 1000);
    });
    return () => {
      cancelled = true;
      clearTimeout(gap);
      if (service.playing() === key) service.stop();
    };
  }, [playing, line, rate, lines, key, silentFallback]);

  /** Moves to a line (clamped to the lines there are), keeping play or pause. */
  const goTo = (index: number) => {
    setFinished(false);
    setLine(Math.min(lines.length - 1, Math.max(0, index)));
  };
  /** Play or pause; play after the last line starts again from the first. */
  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (finished) goTo(0);
    setPlaying(true);
  };

  return { line, playing, finished, goTo, togglePlay };
}
