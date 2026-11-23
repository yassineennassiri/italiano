"use client";

import { type ReactNode, useEffect, useId } from "react";
import type { Rate } from "@/audio/audio-service";
import { SUBTITLE_MODES, type SubtitleMode } from "@/audio/subtitles";
import { progressQueue, submitSettings } from "@/progress/client";
import type { Settings } from "@/settings/settings";
import { ui } from "@/ui-it";
import { SPEED_OPTIONS } from "./scene-player";
import { useVoices } from "./use-audio";
import { useSettings } from "./use-settings";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="mt-6 rounded-lg bg-tint px-6 py-6">
      <h2 id={id} className="text-xl font-bold text-brand">
        {title}
      </h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** A labelled group of radio buttons, one of them checked. */
function RadioChoice<T extends string | number>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="font-semibold">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-4">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2">
            <input
              type="radio"
              name={name}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="size-4 accent-brand"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The voice picker: this computer's Italian voices, kept in its `localStorage`. */
function VoicePicker() {
  const id = useId();
  const { voices, voice, choose } = useVoices();
  if (voices.length === 0) return <p>{ui.settings.noVoice}</p>;
  return (
    <div>
      <label htmlFor={id} className="block font-semibold">
        {ui.settings.voice}
      </label>
      <select
        id={id}
        value={voice ?? ""}
        onChange={(event) => choose(event.target.value)}
        className="mt-1 block w-full rounded-md border-2 border-brand bg-background px-2 py-1"
      >
        {voices.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Impostazioni (SPEC §10.1). The synced settings change at once and are
 * queued like every other write; the voice is this computer's own. When the
 * page couldn't read the saved settings, the last ones this tab knows (or the
 * defaults) show, and never count as saved.
 */
export function SettingsForm({ saved, loaded }: { saved: Settings; loaded: boolean }) {
  const settings = useSettings(loaded ? saved : undefined);
  useEffect(() => {
    if (!loaded) progressQueue.reportUnreachable();
  }, [loaded]);

  return (
    <>
      {!loaded && <p className="mt-4 text-muted">{ui.settings.notLoaded}</p>}
      <Section title={ui.settings.lessons}>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={settings.injectReview}
            onChange={(event) => submitSettings({ inject_review: event.target.checked })}
            className="mt-1 size-4 accent-brand"
          />
          <span>
            <span className="block font-semibold">{ui.settings.ripasso}</span>
            <span className="block text-sm text-muted">{ui.settings.ripassoHint}</span>
          </span>
        </label>
      </Section>
      <Section title={ui.settings.scene} hint={ui.settings.sceneHint}>
        <RadioChoice<SubtitleMode>
          legend={ui.settings.subtitles}
          options={SUBTITLE_MODES.map((mode) => ({ value: mode, label: ui.lesson.player.subtitleModes[mode] }))}
          value={settings.subtitles}
          onChange={(subtitles) => submitSettings({ subtitles })}
        />
        <RadioChoice<Rate> legend={ui.settings.speed} options={SPEED_OPTIONS} value={settings.sceneSpeed} onChange={(scene_speed) => submitSettings({ scene_speed })} />
      </Section>
      <Section title={ui.settings.voice} hint={ui.settings.voiceHint}>
        <VoicePicker />
      </Section>
    </>
  );
}
