import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import type { Item } from "@/content/schema";
import { audioChoiceClips } from "./audio-choice";

const lesson = loadLesson("a2.u01.l02")!;
const item = (id: string) => lesson.steps.flatMap((step) => step.items).find((candidate) => candidate.id === id) as Extract<Item, { type: "audio_choice" }>;
const ELETTRICISTA = item("a2.u01.l02.s05.i02");

describe("audioChoiceClips: what an audio_choice item's 🔊 plays", () => {
  it("plays exactly its clip's scene lines, in order, with their MP3s when they have them", () => {
    const scene = { lines: lesson.scene.lines.map((line) => (line.id === "L12" ? { ...line, audio: "audio/a2/u01/l02/l12.mp3" } : line)) };
    expect(audioChoiceClips(ELETTRICISTA, scene)).toEqual([
      { text: "Che bello! Ma c'è un problema: in cucina la luce non funziona." },
      { text: "Ah, sì, il problema della luce… Domani chiamo un elettricista.", audio: "audio/a2/u01/l02/l12.mp3" },
      { text: "Non serve, signora: sono un ingegnere elettrico!" },
    ]);
  });

  it("plays its prompt_audio when it has no clip", () => {
    const withAudio = { ...ELETTRICISTA, clip: undefined, prompt_audio: "audio/a2/u01/l02/prompt.mp3" };
    expect(audioChoiceClips(withAudio, lesson.scene)).toEqual([{ text: "Adam non vuole un elettricista, …", audio: "audio/a2/u01/l02/prompt.mp3" }]);
  });

  it("plays nothing, so there is no 🔊, with neither a clip nor prompt_audio", () => {
    expect(audioChoiceClips({ ...ELETTRICISTA, clip: undefined }, lesson.scene)).toBeNull();
  });
});
