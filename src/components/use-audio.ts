"use client";

import { useSyncExternalStore } from "react";
import { audioService, type Availability, type Clip } from "@/audio/audio-service";

const subscribe = (listener: () => void) => audioService().subscribe(listener);
const snapshot = () => `${audioService().availability()}|${audioService().playing() ?? ""}`;
// The server has no voices: speech counts as unavailable until the page hydrates.
const serverSnapshot = () => "unavailable|";

/**
 * The audio service's state, re-rendering when the voice availability or the
 * clip playing changes. Call `audioService()` itself only in event handlers and effects.
 */
export function useAudio(): { availability: Availability; playing: string | null; canPlay: (clip: Clip) => boolean } {
  const [availability, playing] = useSyncExternalStore(subscribe, snapshot, serverSnapshot).split("|") as [Availability, string];
  return { availability, playing: playing || null, canPlay: (clip) => clip.audio !== undefined || availability === "speech" };
}
