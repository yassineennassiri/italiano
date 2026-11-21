import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioService, type AudioLike, canPlayClip, type SpeechLike, type UtteranceLike } from "./audio-service";

type Voice = { lang: string; name: string };
const ITALIAN: Voice = { lang: "it-IT", name: "Elsa" };
const ENGLISH: Voice = { lang: "en-US", name: "Zira" };

/** A speechSynthesis stand-in: records what it was asked to say; `finish()` ends the current utterance. */
function fakeSpeech(voices: Voice[]) {
  const spoken: UtteranceLike[] = [];
  let onVoicesChanged: (() => void) | undefined;
  const speech: SpeechLike = {
    getVoices: () => voices,
    speak: (utterance) => void spoken.push(utterance),
    cancel: () => spoken.at(-1)?.onerror?.({ error: "interrupted" }),
    addEventListener: (_type, listener) => void (onVoicesChanged = listener),
  };
  return {
    speech,
    spoken,
    finish: () => spoken.at(-1)?.onend?.(),
    fail: (error: string) => spoken.at(-1)?.onerror?.({ error }),
    loadVoices: (more: Voice[]) => {
      voices.push(...more);
      onVoicesChanged?.();
    },
  };
}

/** An HTMLAudioElement stand-in for MP3s; `fail` makes play() reject, as for a missing file. */
function fakeAudio({ fail = false } = {}) {
  const created: (AudioLike & { url: string; paused: boolean })[] = [];
  const createAudio = (url: string) => {
    const audio = {
      url,
      playbackRate: 1,
      paused: true,
      onended: null as (() => void) | null,
      onerror: null as (() => void) | null,
      play: () => {
        audio.paused = false;
        return fail ? Promise.reject(new Error("404")) : Promise.resolve();
      },
      pause: () => void (audio.paused = true),
    };
    created.push(audio);
    return audio;
  };
  return { createAudio, created };
}

afterEach(() => vi.useRealTimers());

describe("AudioService", () => {
  it("plays a clip's MP3 when it has one, at the chosen speed, and never speaks it", async () => {
    const { speech, spoken } = fakeSpeech([ITALIAN]);
    const { createAudio, created } = fakeAudio();
    const service = new AudioService({ speech, createAudio });
    const done = service.play({ text: "Buongiorno!", audio: "audio/a2/l1.mp3" }, { rate: 0.75 });
    await Promise.resolve();
    expect(created[0]).toMatchObject({ url: "/media/audio/a2/l1.mp3", playbackRate: 0.75, paused: false });
    created[0].onended!();
    expect(await done).toBe("ended");
    expect(spoken).toEqual([]);
  });

  it("speaks the clip when its MP3 can't be played", async () => {
    const { speech, spoken, finish } = fakeSpeech([ITALIAN]);
    const service = new AudioService({ speech, createAudio: fakeAudio({ fail: true }).createAudio });
    const done = service.play({ text: "Buongiorno!", audio: "audio/missing.mp3" });
    await vi.waitFor(() => expect(spoken).toHaveLength(1));
    finish();
    expect(await done).toBe("ended");
  });

  it("speaks with an Italian voice at the chosen speed when there is no MP3", async () => {
    const { speech, spoken, finish } = fakeSpeech([ENGLISH, ITALIAN]);
    const service = new AudioService({ speech, createAudio: fakeAudio().createAudio });
    expect(service.availability()).toBe("speech");
    const done = service.play({ text: "Sì, sono io." }, { rate: 0.75 });
    expect(spoken[0]).toMatchObject({ text: "Sì, sono io.", lang: "it-IT", voice: ITALIAN, rate: 0.75 });
    finish();
    expect(await done).toBe("ended");
  });

  it("is unavailable without an Italian voice, and says so instead of speaking English", async () => {
    const { speech, spoken } = fakeSpeech([ENGLISH]);
    const service = new AudioService({ speech, createAudio: fakeAudio().createAudio });
    expect(service.availability()).toBe("unavailable");
    expect(canPlayClip({ text: "Ciao" }, service.availability())).toBe(false);
    expect(canPlayClip({ text: "Ciao", audio: "audio/ciao.mp3" }, service.availability())).toBe(true);
    expect(await service.play({ text: "Ciao" })).toBe("unavailable");
    expect(spoken).toEqual([]);
  });

  it("can stay silent for the clip's estimated time instead, for the scene player", async () => {
    vi.useFakeTimers();
    const service = new AudioService({ speech: undefined, createAudio: fakeAudio().createAudio });
    let result: string | undefined;
    void service.play({ text: "x".repeat(28) }, { silentFallback: true }).then((value) => (result = value));
    await vi.advanceTimersByTimeAsync(1900);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(200);
    expect(result).toBe("ended");
  });

  it("turns available when the browser loads its voices late, and tells its listeners", () => {
    const voices = fakeSpeech([]);
    const service = new AudioService({ speech: voices.speech, createAudio: fakeAudio().createAudio });
    const listener = vi.fn();
    service.subscribe(listener);
    expect(service.availability()).toBe("unavailable");
    voices.loadVoices([ITALIAN]);
    expect(service.availability()).toBe("speech");
    expect(listener).toHaveBeenCalled();
  });

  it("plays one clip at a time: a new clip stops the one playing", async () => {
    const { speech } = fakeSpeech([ITALIAN]);
    const { createAudio, created } = fakeAudio();
    const service = new AudioService({ speech, createAudio });
    const first = service.play({ text: "Uno", audio: "audio/uno.mp3" }, { key: "uno" });
    await Promise.resolve();
    expect(service.playing()).toBe("uno");
    const second = service.play({ text: "Due" }, { key: "due" });
    expect(await first).toBe("stopped");
    expect(created[0].paused).toBe(true);
    expect(service.playing()).toBe("due");
    service.stop();
    expect(await second).toBe("stopped");
    expect(service.playing()).toBeNull();
  });
});

describe("AudioService when things go wrong in a real browser", () => {
  it("falls back to the voice when an MP3 fails after it started", async () => {
    const { speech, spoken, finish } = fakeSpeech([ITALIAN]);
    const { createAudio, created } = fakeAudio();
    const service = new AudioService({ speech, createAudio });
    const done = service.play({ text: "Ciao", audio: "audio/ciao.mp3" });
    await Promise.resolve();
    created[0].onerror!();
    expect(spoken).toHaveLength(1);
    finish();
    expect(await done).toBe("ended");
  });

  it("treats a voice that fails (an offline network voice) as unavailable, and tells its listeners", async () => {
    vi.useFakeTimers();
    const { speech, fail } = fakeSpeech([ITALIAN]);
    const service = new AudioService({ speech, createAudio: fakeAudio().createAudio });
    const listener = vi.fn();
    service.subscribe(listener);
    let result: string | undefined;
    void service.play({ text: "x".repeat(28) }, { silentFallback: true }).then((value) => (result = value));
    fail("network");
    expect(service.availability()).toBe("unavailable");
    expect(listener).toHaveBeenCalled();
    // The scene player still gets the line's time, silently.
    await vi.advanceTimersByTimeAsync(1900);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(200);
    expect(result).toBe("ended");
    expect(await service.play({ text: "Ciao" })).toBe("unavailable");
  });

  it("gives up on an utterance that never ends (Chrome can drop one after cancel), so playback can't stick", async () => {
    vi.useFakeTimers();
    const { speech } = fakeSpeech([ITALIAN]);
    const service = new AudioService({ speech, createAudio: fakeAudio().createAudio });
    let result: string | undefined;
    void service.play({ text: "x".repeat(28) }).then((value) => (result = value));
    // Estimated 2 s; the watchdog allows twice that plus 2 s.
    await vi.advanceTimersByTimeAsync(5900);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(200);
    expect(result).toBe("ended");
  });
});

describe("canPlayClip", () => {
  it("can play a clip with an MP3 anywhere, and one without only with an Italian voice", () => {
    expect(canPlayClip({ text: "Ciao", audio: "a.mp3" }, "unavailable")).toBe(true);
    expect(canPlayClip({ text: "Ciao" }, "speech")).toBe(true);
    expect(canPlayClip({ text: "Ciao" }, "unavailable")).toBe(false);
  });
});
