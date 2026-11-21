"use client";

import { useSyncExternalStore } from "react";
import { audioService, type Availability, canPlayClip, type Clip } from "@/audio/audio-service";

/** The server has no voices: until the page hydrates, speech counts as unavailable. */
const SERVER = -1;
const subscribe = (listener: () => void) => audioService().subscribe(listener);
const version = () => audioService().version();

/** The audio service's state, re-rendering when the voice availability or the clip playing changes. */
export function useAudio(): { availability: Availability; playing: string | null; canPlay: (clip: Clip) => boolean } {
  const hydrated = useSyncExternalStore(subscribe, version, () => SERVER) !== SERVER;
  const availability = hydrated ? audioService().availability() : "unavailable";
  return {
    availability,
    playing: hydrated ? audioService().playing() : null,
    canPlay: (clip) => canPlayClip(clip, availability),
  };
}
