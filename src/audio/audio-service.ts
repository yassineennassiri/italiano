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
import { estimateLineSeconds, LINE_GAP_S } from "./scene-timeline";

/** Something to say: Italian text, and the content media path of its MP3 if there is one. */
export type Clip = { text: string; audio?: string };

/** How a play ended: it finished, it was stopped (or replaced), or it couldn't be heard at all. */
export type PlayResult = "ended" | "stopped" | "unavailable";

/** The speaking speed: normal or slower (SPEC §11.3). */
export type Rate = 1 | 0.75;

export type PlayOptions = {
  rate?: Rate;
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
export type AudioLike = {
  playbackRate: number;
  play: () => Promise<void>;
  pause: () => void;
  onended: (() => void) | null;
  onerror: (() => void) | null;
};

export type AudioEnvironment = {
  speech: SpeechLike | undefined;
  createAudio: (url: string) => AudioLike;
  createUtterance?: (text: string) => UtteranceLike;
};

/** Whether text without an MP3 can be heard: "speech" with an Italian voice, else "unavailable". */
export type Availability = "speech" | "unavailable";

const isItalian = (voice: VoiceLike) => voice.lang.toLowerCase().replace("_", "-").startsWith("it");

const asList = (clips: Clip | readonly Clip[]): readonly Clip[] => ("text" in clips ? [clips] : clips);

/** Whether a clip, or every one of several, can be heard: it has an MP3, or there is a working Italian voice. */
export const canPlayClip = (clips: Clip | readonly Clip[], availability: Availability): boolean =>
  asList(clips).every((clip) => clip.audio !== undefined || availability === "speech");

/** How long an utterance may take before it counts as lost (Chrome can drop one after cancel). */
const watchdogMs = (text: string, rate: number) => (estimateLineSeconds(text, rate) * 2 + 2) * 1000;

export class AudioService {
  private readonly listeners = new Set<() => void>();
  private voice: VoiceLike | undefined;
  /** Stops whatever plays now; set while a clip plays. */
  private stopCurrent: (() => void) | undefined;
  private currentKey: string | null = null;
  /** Set when the voice failed (an offline network voice); cleared when the browser's voices change. */
  private voiceFailed = false;
  private changes = 0;

  constructor(private readonly env: AudioEnvironment) {
    this.voice = env.speech?.getVoices().find(isItalian);
    // Chrome and Edge load their voices after the page; listen for them.
    env.speech?.addEventListener("voiceschanged", () => {
      this.voice = env.speech?.getVoices().find(isItalian);
      this.voiceFailed = false;
      this.changed();
    });
  }

  availability(): Availability {
    return this.voice && !this.voiceFailed ? "speech" : "unavailable";
  }

  /** Changes whenever `availability()` or `playing()` does, for `useSyncExternalStore`. */
  version(): number {
    return this.changes;
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

  /**
   * Plays a clip, or several one after another with a short gap between them
   * (a clip of scene lines, SPEC §5.2.8), stopping whatever plays now. `key`
   * names them the whole time, gaps included. Resolves when the last one ends,
   * or as soon as one is stopped or can't be heard.
   */
  play(clips: Clip | readonly Clip[], { rate = 1, key, silentFallback = false }: PlayOptions = {}): Promise<PlayResult> {
    const queue = asList(clips);
    this.stop();
    return new Promise((resolve) => {
      let settled = false;
      let cancel = () => {};
      const settle = (result: PlayResult) => {
        if (settled) return;
        settled = true;
        cancel();
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

      const playFrom = (index: number) => {
        if (index >= queue.length) return settle("ended");
        cancel = this.sound(queue[index], rate, silentFallback, (result) => {
          if (result !== "ended" || index + 1 >= queue.length) return settle(result);
          const gap = setTimeout(() => playFrom(index + 1), LINE_GAP_S * 1000);
          cancel = () => clearTimeout(gap);
        });
      };
      playFrom(0);
    });
  }

  /** Makes one clip heard: its MP3, else the voice, else (with `silentFallback`) its estimated time. Returns a cancel. */
  private sound(clip: Clip, rate: Rate, silentFallback: boolean, done: (result: PlayResult) => void): () => void {
    let over = false;
    let cleanup = () => {};
    const finish = (result: PlayResult) => {
      if (over) return;
      over = true;
      cleanup();
      done(result);
    };

    const speakOrWait = () => {
      if (over) return;
      if (this.availability() === "speech" && this.env.speech) {
        const speech = this.env.speech;
        const utterance = this.env.createUtterance?.(clip.text) ?? { text: clip.text };
        utterance.lang = "it-IT";
        utterance.voice = this.voice;
        utterance.rate = rate;
        // An utterance that never ends (dropped after a cancel) mustn't leave playback stuck.
        const watchdog = setTimeout(() => finish("ended"), watchdogMs(clip.text, rate));
        utterance.onend = () => finish("ended");
        utterance.onerror = (event) => {
          if (event.error === "interrupted" || event.error === "canceled") return finish("stopped");
          // The voice itself failed: count it as unavailable, and carry on without it.
          clearTimeout(watchdog);
          utterance.onend = null;
          utterance.onerror = null;
          this.voiceFailed = true;
          this.changed();
          speakOrWait();
        };
        cleanup = () => {
          clearTimeout(watchdog);
          utterance.onend = null;
          utterance.onerror = null;
          speech.cancel();
        };
        speech.speak(utterance);
      } else if (silentFallback) {
        const timer = setTimeout(() => finish("ended"), estimateLineSeconds(clip.text, rate) * 1000);
        cleanup = () => clearTimeout(timer);
      } else {
        finish("unavailable");
      }
    };

    if (clip.audio === undefined) {
      speakOrWait();
    } else {
      const audio = this.env.createAudio(mediaUrl(clip.audio));
      audio.playbackRate = rate;
      // A missing, blocked or broken MP3 falls back to the voice.
      const fallBack = () => {
        if (over) return;
        audio.onended = null;
        audio.onerror = null;
        speakOrWait();
      };
      audio.onended = () => finish("ended");
      audio.onerror = fallBack;
      cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
      };
      audio.play().catch(fallBack);
    }

    return () => {
      if (over) return;
      over = true;
      cleanup();
    };
  }

  /** Stops the clip playing, if any. */
  stop(): void {
    this.stopCurrent?.();
  }

  private changed(): void {
    this.changes++;
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
