"use client";

import Image from "next/image";
import { type ReactNode, type Ref, useEffect, useRef, useState } from "react";
import { audioService } from "@/audio/audio-service";
import { estimateSceneSeconds, LINE_GAP_S, panelIndexAt, SUBTITLE_MODES, type SubtitleMode } from "@/audio/scene-timeline";
import { mediaUrl } from "@/content/media-url";
import type { Scene } from "@/content/schema";
import { ui } from "@/ui-it";
import { useAudio } from "./use-audio";

/** The audio service's key for the line the player is saying. */
const PLAYER_KEY = "scene-player";
const SIZES = "(min-width: 1024px) 960px, 100vw";
const SPEEDS = [
  { rate: 1, label: ui.lesson.player.speeds.normal },
  { rate: 0.75, label: ui.lesson.player.speeds.slow },
] as const;

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" focusable="false">
      <path d={path} fill="currentColor" />
    </svg>
  );
}
const PLAY = "M8 5 L19 12 L8 19 Z";
const PAUSE = "M7 5 H10.5 V19 H7 Z M13.5 5 H17 V19 H13.5 Z";
const PREVIOUS = "M6 5 H8.5 V19 H6 Z M19 5 V19 L9.5 12 Z";
const NEXT = "M15.5 5 H18 V19 H15.5 Z M5 5 L14.5 12 L5 19 Z";

function ControlButton({
  label,
  onClick,
  disabled,
  ref,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-full text-brand hover:bg-tint disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** A small labelled group of toggle buttons, one of them pressed. */
function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1 text-sm">
      <span className="mr-1 text-muted">{label}</span>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          className={`rounded-full px-2.5 py-0.5 font-semibold disabled:opacity-40 ${option.value === value ? "bg-brand text-white" : "text-brand hover:bg-tint"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The scene player (SPEC §4.1, §11.3). First the poster with ▶ and the
 * duration; once started, the panels crossfade at each panel's `from_line`
 * while the lines play one by one: their MP3s if generated, else the
 * browser's Italian voice. With neither, it runs silently on estimated timings
 * with Italian subtitles. The scrubber is line-based ("riga 4 di 11").
 */
export function ScenePlayer({ scene, lessonTitle }: { scene: Scene; lessonTitle: string }) {
  const audio = useAudio();
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [line, setLine] = useState(0);
  const [rate, setRate] = useState<number>(1);
  const [subtitles, setSubtitles] = useState<SubtitleMode>("off");

  const total = scene.lines.length;
  const allMp3 = scene.lines.every((sceneLine) => sceneLine.audio !== undefined);
  // Some lines can't be heard: subtitles can't be turned off.
  const silent = !allMp3 && audio.availability !== "speech";
  const shownSubtitles: SubtitleMode = silent && subtitles === "off" ? "it" : subtitles;
  const duration = allMp3 ? ui.lesson.duration(scene.duration_s) : ui.lesson.estimatedDuration(Math.round(estimateSceneSeconds(scene.lines)));
  const current = scene.lines[line];
  // The poster's ▶ goes away on start: keyboard focus moves to play/pause.
  const playPause = useRef<HTMLButtonElement>(null);
  const focusOnStart = useRef(false);
  useEffect(() => {
    if (!started || !focusOnStart.current) return;
    focusOnStart.current = false;
    playPause.current?.focus();
  }, [started]);
  const panel = panelIndexAt(scene, line);

  // Say the current line; when it ends, pause briefly and move on, or stop after the last.
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    let gap: ReturnType<typeof setTimeout> | undefined;
    const service = audioService();
    const { it, audio: mp3 } = scene.lines[line];
    void service.play({ text: it, audio: mp3 }, { rate, key: PLAYER_KEY, silentFallback: true }).then((result) => {
      if (cancelled) return;
      if (result !== "ended") return setPlaying(false); // Another clip (a 🔊 button) took over.
      if (line + 1 >= scene.lines.length) {
        setPlaying(false);
        setFinished(true);
        return;
      }
      gap = setTimeout(() => setLine(line + 1), LINE_GAP_S * 1000);
    });
    return () => {
      cancelled = true;
      clearTimeout(gap);
      if (service.playing() === PLAYER_KEY) service.stop();
    };
  }, [playing, line, rate, scene.lines]);

  const goTo = (index: number) => {
    setStarted(true);
    setFinished(false);
    setLine(Math.min(total - 1, Math.max(0, index)));
  };
  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (finished) goTo(0);
    setStarted(true);
    setPlaying(true);
  };

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-tint">
        {started ? (
          scene.panels.map((scenePanel, index) => (
            <Image
              key={scenePanel.image}
              src={mediaUrl(scenePanel.image)}
              alt={ui.lesson.player.panelAlt(index + 1, scene.panels.length)}
              aria-hidden={index !== panel}
              fill
              sizes={SIZES}
              className={`object-cover transition-opacity duration-700 ${index === panel ? "opacity-100" : "opacity-0"}`}
            />
          ))
        ) : (
          <>
            <Image src={mediaUrl(scene.poster)} alt={ui.lesson.posterAlt(lessonTitle)} fill sizes={SIZES} className="object-cover" priority />
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <button
                type="button"
                aria-label={ui.lesson.player.play}
                onClick={() => {
                  focusOnStart.current = true;
                  togglePlay();
                }}
                className="inline-flex size-14 items-center justify-center rounded-full bg-accent text-foreground shadow-lg hover:brightness-95"
              >
                <Icon path={PLAY} />
              </button>
              <span className="rounded bg-black/60 px-2 py-1 text-sm font-semibold text-white">{duration}</span>
            </div>
          </>
        )}
        {started && shownSubtitles !== "off" && (
          <div aria-live="polite" className="absolute inset-x-0 bottom-0 bg-black/65 px-4 py-2 text-center text-white">
            <p className="font-semibold">{current.it}</p>
            {shownSubtitles === "it_en" && <p className="text-sm opacity-90">{current.en}</p>}
          </div>
        )}
      </div>
      {started && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-tint px-3 py-2">
          <div className="flex items-center gap-1">
            <ControlButton label={ui.lesson.player.previousLine} onClick={() => goTo(line - 1)} disabled={line === 0}>
              <Icon path={PREVIOUS} />
            </ControlButton>
            <ControlButton ref={playPause} label={playing ? ui.lesson.player.pause : ui.lesson.player.play} onClick={togglePlay}>
              <Icon path={playing ? PAUSE : PLAY} />
            </ControlButton>
            <ControlButton label={ui.lesson.player.nextLine} onClick={() => goTo(line + 1)} disabled={line === total - 1}>
              <Icon path={NEXT} />
            </ControlButton>
          </div>
          <label className="flex min-w-40 flex-1 items-center gap-2 text-sm text-muted">
            <span className="sr-only">{ui.lesson.player.scrubber}</span>
            <input
              type="range"
              min={1}
              max={total}
              value={line + 1}
              aria-valuetext={ui.lesson.player.lineOf(line + 1, total)}
              onChange={(event) => goTo(Number(event.target.value) - 1)}
              className="flex-1 accent-brand"
            />
            <span className="whitespace-nowrap">{ui.lesson.player.lineOf(line + 1, total)}</span>
          </label>
          <Choice
            label={ui.lesson.player.speed}
            options={SPEEDS.map(({ rate: value, label }) => ({ value, label }))}
            value={rate}
            onChange={setRate}
          />
          <Choice
            label={ui.lesson.player.subtitles}
            options={SUBTITLE_MODES.map((mode) => ({ value: mode, label: ui.lesson.player.subtitleModes[mode], disabled: silent && mode === "off" }))}
            value={shownSubtitles}
            onChange={setSubtitles}
          />
        </div>
      )}
      {started && silent && <p className="mt-2 text-sm text-muted">{ui.lesson.noItalianVoice}</p>}
    </div>
  );
}
