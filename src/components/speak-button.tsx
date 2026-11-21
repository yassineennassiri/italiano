"use client";

import { useId } from "react";
import { audioService, type Clip } from "@/audio/audio-service";
import { ui } from "@/ui-it";
import { useAudio } from "./use-audio";

const PATHS = {
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />,
  play: <path d="M8 5 L19 12 L8 19 Z" fill="currentColor" />,
  speaker: (
    <>
      <path d="M4 9.5 H8 L13 5.5 V18.5 L8 14.5 H4 Z" fill="currentColor" />
      <path d="M16 9 Q18 12 16 15 M18.5 6.5 Q22.5 12 18.5 17.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
};

/**
 * The 🔊 button (SPEC §11.1), or ▶ for a script line (§4.8): plays `clip`
 * through the audio service, or stops it while it plays (■). When the clip has
 * no MP3 and the browser has no working Italian voice it does nothing, but
 * stays focusable and says why, so keyboard and screen-reader users hear the
 * reason too. `id` names the clip while it plays.
 */
export function SpeakButton({ id, clip, icon = "speaker", className = "" }: { id: string; clip: Clip; icon?: "speaker" | "play"; className?: string }) {
  const audio = useAudio();
  const reasonId = useId();
  const isPlaying = audio.playing === id;
  const canPlay = audio.canPlay(clip);
  return (
    <button
      type="button"
      aria-disabled={!canPlay}
      aria-describedby={canPlay ? undefined : reasonId}
      aria-label={isPlaying ? ui.lesson.stopListening : ui.lesson.listen}
      aria-pressed={isPlaying}
      title={canPlay ? undefined : ui.lesson.noItalianVoice}
      onClick={() => {
        if (!canPlay) return;
        if (isPlaying) audioService().stop();
        else void audioService().play(clip, { key: id });
      }}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-brand hover:bg-tint aria-disabled:cursor-not-allowed aria-disabled:opacity-40 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" focusable="false">
        {PATHS[isPlaying ? "stop" : icon]}
      </svg>
      {!canPlay && (
        <span id={reasonId} className="sr-only">
          {ui.lesson.noItalianVoice}
        </span>
      )}
    </button>
  );
}
