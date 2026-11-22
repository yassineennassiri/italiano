"use client";

import { type FormEvent, useId, useState } from "react";
import { submitNewCorrection } from "@/progress/client";
import type { ExplainedTag } from "@/review/error-card";
import { ui } from "@/ui-it";
import { ACCENT_CLASS } from "./accent-link";

const FIELD_CLASS = "mt-1 block w-full rounded-md border-2 border-brand bg-background px-2 py-1";

/**
 * A labelled textarea. The label points at it rather than wrapping it: a
 * wrapping label would add the typed text to the field's accessible name.
 */
function TextField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required} rows={2} className={FIELD_CLASS} />
    </div>
  );
}

/**
 * *Aggiungi una correzione* (SPEC §10.5): what I said, the corrected version,
 * any tags from `error-tags.json` and an optional note. It can't be saved
 * while either text is blank. Saving queues the write (an error_log row with
 * `source = manual` and its error card, due tomorrow) and empties the form.
 */
export function CorrectionForm({ tags }: { tags: readonly ExplainedTag[] }) {
  const [given, setGiven] = useState("");
  const [expected, setExpected] = useState("");
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const ready = given.trim() !== "" && expected.trim() !== "";

  const change = (set: (value: string) => void) => (value: string) => {
    set(value);
    setSaved(false);
  };
  const toggle = (tag: string) => {
    setChosen((before) => {
      const after = new Set(before);
      if (!after.delete(tag)) after.add(tag);
      return after;
    });
    setSaved(false);
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    submitNewCorrection({ given, expected, errorTags: tags.map((tag) => tag.id).filter((tag) => chosen.has(tag)), note });
    setGiven("");
    setExpected("");
    setChosen(new Set());
    setNote("");
    setSaved(true);
  };

  return (
    <form onSubmit={save} className="mt-4 space-y-4">
      <TextField label={ui.review.correction.given} value={given} onChange={change(setGiven)} required />
      <TextField label={ui.review.correction.expected} value={expected} onChange={change(setExpected)} required />
      <fieldset>
        <legend className="font-semibold">{ui.review.correction.tags}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <label key={tag.id} title={tag.explanation} className="flex items-center gap-1.5 rounded-full border-2 border-line bg-background px-3 py-1 text-sm has-checked:border-brand">
              <input type="checkbox" checked={chosen.has(tag.id)} onChange={() => toggle(tag.id)} className="accent-brand" />
              {tag.id}
            </label>
          ))}
        </div>
      </fieldset>
      <TextField label={ui.review.correction.note} value={note} onChange={change(setNote)} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={!ready} className={`${ACCENT_CLASS} disabled:opacity-40`}>
          {ui.review.correction.save}
        </button>
        <p role="status" className="text-ok">
          {saved ? ui.review.correction.saved : ""}
        </p>
      </div>
    </form>
  );
}
