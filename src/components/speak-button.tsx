"use client";

import { audioService, type Clip } from "@/audio/audio-service";
import { ui } from "@/ui-it";
import { useAudio } from "./use-audio";

/** 🔊 as a speaker icon, or ■ while this clip plays. */
function SpeakerIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" focusable="false">
      {playing ? (
        <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
      ) : (
        <>
          <path d="M4 9.5 H8 L13 5.5 V18.5 L8 14.5 H4 Z" fill="currentColor" />
          <path d="M16 9 Q18 12 16 15 M18.5 6.5 Q22.5 12 18.5 17.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/**
 * The 🔊 button (SPEC §11.1): plays `clip` through the audio service, or stops
 * it while it plays. Disabled, with the reason as its title, when the clip has
 * no MP3 and the browser has no Italian voice. `id` names the clip while it plays.
 */
export function SpeakButton({ id, clip, label = ui.lesson.listen, className = "" }: { id: string; clip: Clip; label?: string; className?: string }) {
  const audio = useAudio();
  const isPlaying = audio.playing === id;
  const canPlay = audio.canPlay(clip);
  return (
    <button
      type="button"
      disabled={!canPlay}
      aria-label={isPlaying ? ui.lesson.stopListening : label}
      aria-pressed={isPlaying}
      title={canPlay ? undefined : ui.lesson.noItalianVoice}
      onClick={() => (isPlaying ? audioService().stop() : void audioService().play(clip, { key: id }))}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-brand hover:bg-tint disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <SpeakerIcon playing={isPlaying} />
    </button>
  );
}
