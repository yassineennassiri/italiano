"use client";

import { useId } from "react";
import { canPlayClip } from "@/audio/audio-service";
import { estimateSceneSeconds } from "@/audio/scene-timeline";
import { ui } from "@/ui-it";
import { useAudio } from "./use-audio";
import { type PlaybackLine, useLinePlayback } from "./use-line-playback";

const PLAY = "M8 5 L19 12 L8 19 Z";
const PAUSE = "M7 5 H10.5 V19 H7 Z M13.5 5 H17 V19 H13.5 Z";

/**
 * An audio-only clip player (SPEC §5.2.8, §9.1, `[39]`): it plays a clip's
 * scene lines one by one, with play/pause, line-based progress ("riga 2 di
 * 4") and an estimated duration with a tilde, as in the scene player's
 * fallback mode (§11.3). A step's `media.kind: "clip"` shows one at the top;
 * `audio_gap` reuses it as its mini player. Without an MP3 for every line and
 * without an Italian voice, play is unavailable and it says why.
 */
export function ClipPlayer({ lines, className = "" }: { lines: readonly PlaybackLine[]; className?: string }) {
  const key = `clip:${useId()}`;
  const audio = useAudio();
  const reasonId = useId();
  const { line, playing, togglePlay } = useLinePlayback(lines, { key });
  const canPlay = canPlayClip(
    lines.map(({ it, audio: mp3 }) => ({ text: it, audio: mp3 })),
    audio.availability,
  );
  const total = lines.length;
  const label = playing ? ui.lesson.clipPlayer.pause : ui.lesson.clipPlayer.play;

  return (
    <div role="group" aria-label={ui.lesson.clipPlayer.label} data-clip-player className={`rounded-lg bg-tint px-4 py-3 ${className}`}>
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={label}
          title={canPlay ? label : ui.lesson.clipPlayer.noVoice}
          aria-disabled={!canPlay}
          aria-describedby={canPlay ? undefined : reasonId}
          onClick={() => canPlay && togglePlay()}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-foreground shadow hover:brightness-95 aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" focusable="false">
            <path d={playing ? PAUSE : PLAY} fill="currentColor" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-tint-strong" aria-hidden="true">
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${((line + 1) / total) * 100}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-sm text-muted">
            <span>{ui.lesson.player.lineOf(line + 1, total)}</span>
            <span>{ui.lesson.estimatedDuration(Math.round(estimateSceneSeconds(lines)))}</span>
          </div>
        </div>
      </div>
      {!canPlay && (
        <p id={reasonId} className="mt-2 text-sm text-muted">
          {ui.lesson.clipPlayer.noVoice}
        </p>
      )}
    </div>
  );
}
