/**
 * The one audio service behind the scene player, the 🔊 buttons and the
 * Copione ▶ (SPEC §11.1, §11.3). A clip is a line of Italian text, with an MP3
 * when one was generated. The MP3 always wins; without one the browser's
 * `speechSynthesis` reads the text with an Italian voice. With no Italian voice
 * (or no speechSynthesis) speech is unavailable: buttons say so, and the scene
 * player can run silently on estimated timings instead of speaking English.
 * One clip plays at a time. The browser objects are injected, so it runs in tests.
 */
import { mediaUrl } from "@/content/media-url";
import { estimateLineSeconds } from "./scene-timeline";

/** Something to say: Italian text, and the content media path of its MP3 if there is one. */
export type Clip = { text: string; audio?: string };

/** How a play ended: it finished, it was stopped (or replaced), or it couldn't be heard at all. */
export type PlayResult = "ended" | "stopped" | "unavailable";

export type PlayOptions = {
  /** 1 or 0.75 (SPEC §11.3). */
  rate?: number;
  /** Identifies the clip while it plays, e.g. a line id, so its button can show it. */
  key?: string;
  /** With no way to speak, wait the clip's estimated time instead of returning "unavailable". */
  silentFallback?: boolean;
};

/** The parts of a SpeechSynthesisUtterance the service sets and listens to. */
export type UtteranceLike = {
  text: string;
  lang?: string;
  voice?: unknown;
  rate?: number;
  onend?: (() => void) | null;
  onerror?: ((event: { error: string }) => void) | null;
};

type VoiceLike = { lang: string; name: string };

/** The parts of `window.speechSynthesis` the service uses. */
export type SpeechLike = {
  getVoices: () => VoiceLike[];
  speak: (utterance: UtteranceLike) => void;
  cancel: () => void;
  addEventListener: (type: "voiceschanged", listener: () => void) => void;
};

/** The parts of an HTMLAudioElement the service uses. */
export type AudioLike = { playbackRate: number; play: () => Promise<void>; pause: () => void; onended: (() => void) | null };

export type AudioEnvironment = {
  speech: SpeechLike | undefined;
  createAudio: (url: string) => AudioLike;
  createUtterance?: (text: string) => UtteranceLike;
};

/** Whether text without an MP3 can be heard: "speech" with an Italian voice, else "unavailable". */
export type Availability = "speech" | "unavailable";

const isItalian = (voice: VoiceLike) => voice.lang.toLowerCase().replace("_", "-").startsWith("it");

export class AudioService {
  private readonly listeners = new Set<() => void>();
  private voice: VoiceLike | undefined;
  /** Stops whatever plays now; set while a clip plays. */
  private stopCurrent: (() => void) | undefined;
  private currentKey: string | null = null;

  constructor(private readonly env: AudioEnvironment) {
    this.voice = env.speech?.getVoices().find(isItalian);
    // Chrome and Edge load their voices after the page; listen for them.
    env.speech?.addEventListener("voiceschanged", () => {
      this.voice = env.speech?.getVoices().find(isItalian);
      this.changed();
    });
  }

  availability(): Availability {
    return this.voice ? "speech" : "unavailable";
  }

  /** Whether the clip can be heard: it has an MP3, or there is an Italian voice. */
  canPlay(clip: Clip): boolean {
    return clip.audio !== undefined || this.voice !== undefined;
  }

  /** The key of the clip playing, or null. */
  playing(): string | null {
    return this.currentKey;
  }

  /** Listens for changes to `availability()` and `playing()`. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Plays a clip, stopping the one playing; resolves when it ends or is stopped. */
  play(clip: Clip, { rate = 1, key, silentFallback = false }: PlayOptions = {}): Promise<PlayResult> {
    this.stop();
    return new Promise((resolve) => {
      let settled = false;
      let cleanup = () => {};
      const settle = (result: PlayResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (this.stopCurrent === stop) {
          this.stopCurrent = undefined;
          this.currentKey = null;
          this.changed();
        }
        resolve(result);
      };
      const stop = () => settle("stopped");
      this.stopCurrent = stop;
      this.currentKey = key ?? null;
      this.changed();

      const speakOrWait = () => {
        if (settled) return;
        if (this.voice && this.env.speech) {
          const speech = this.env.speech;
          const utterance = this.env.createUtterance?.(clip.text) ?? { text: clip.text };
          utterance.lang = "it-IT";
          utterance.voice = this.voice;
          utterance.rate = rate;
          utterance.onend = () => settle("ended");
          utterance.onerror = (event) => settle(event.error === "interrupted" || event.error === "canceled" ? "stopped" : "ended");
          cleanup = () => {
            utterance.onend = null;
            utterance.onerror = null;
            speech.cancel();
          };
          speech.speak(utterance);
        } else if (silentFallback) {
          const timer = setTimeout(() => settle("ended"), estimateLineSeconds(clip.text, rate) * 1000);
          cleanup = () => clearTimeout(timer);
        } else {
          settle("unavailable");
        }
      };

      if (clip.audio === undefined) {
        speakOrWait();
        return;
      }
      const audio = this.env.createAudio(mediaUrl(clip.audio));
      audio.playbackRate = rate;
      audio.onended = () => settle("ended");
      cleanup = () => {
        audio.onended = null;
        audio.pause();
      };
      // A missing or blocked MP3 falls back to the voice.
      audio.play().catch(() => {
        if (settled) return;
        audio.onended = null;
        speakOrWait();
      });
    });
  }

  /** Stops the clip playing, if any. */
  stop(): void {
    this.stopCurrent?.();
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }
}

let browserService: AudioService | undefined;

/** The browser's speechSynthesis, if it has one. The utterances it gets come from `createUtterance`, so they are real ones. */
function browserSpeech(): SpeechLike | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const synthesis = window.speechSynthesis;
  return {
    getVoices: () => synthesis.getVoices(),
    speak: (utterance) => synthesis.speak(utterance as SpeechSynthesisUtterance),
    cancel: () => synthesis.cancel(),
    addEventListener: (type, listener) => synthesis.addEventListener(type, listener),
  };
}

/** The page's audio service, created on first use in the browser. */
export function audioService(): AudioService {
  browserService ??= new AudioService({
    speech: browserSpeech(),
    // The DOM types want handlers that take an event; ours ignore it, which is fine at runtime.
    createAudio: (url) => new Audio(url) as unknown as AudioLike,
    createUtterance: (text) => new SpeechSynthesisUtterance(text) as unknown as UtteranceLike,
  });
  return browserService;
}
