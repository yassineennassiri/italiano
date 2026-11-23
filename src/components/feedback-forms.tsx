"use client";

import { usePathname } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { type FeedbackWrite, lessonNoteRef, MAX_NOTE } from "@/feedback/notes";
import { submitFeedback } from "@/progress/client";
import { ui } from "@/ui-it";
import { ACCENT_CLASS } from "./accent-link";

/** The dialog's outlined secondary buttons (*Annulla*, *Chiudi*). */
const OUTLINE_CLASS = "rounded-full border-2 border-brand px-6 py-2 font-bold text-brand hover:bg-tint";

/**
 * A note's textarea and its Save button, which stays disabled while the text
 * is blank. Saving queues the note and empties the field; `onSaved` runs after.
 */
function NoteForm({
  note,
  saveLabel,
  onSaved,
  children,
}: {
  /** What the note is about, read when it is saved. */
  note: () => Pick<FeedbackWrite, "scope" | "refId">;
  saveLabel: string;
  onSaved: () => void;
  children?: React.ReactNode;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim() === "") return;
    submitFeedback({ ...note(), text });
    setText("");
    onSaved();
  };
  return (
    <form onSubmit={save} className="mt-3 space-y-3">
      <label htmlFor={id} className="block text-sm font-semibold">
        {ui.feedback.note}
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(event) => setText(event.target.value)}
        required
        maxLength={MAX_NOTE}
        rows={3}
        className="block w-full rounded-md border-2 border-brand bg-background px-2 py-1"
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        {children}
        <button type="submit" disabled={text.trim() === ""} className={`${ACCENT_CLASS} disabled:opacity-40`}>
          {saveLabel}
        </button>
      </div>
    </form>
  );
}

/** The level overview's Feedback card (SPEC §3.3, §10.6): a textarea that saves a `scope = level` note. */
export function LevelFeedbackCard({ levelId }: { levelId: string }) {
  const [saved, setSaved] = useState(false);
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="border-t border-line bg-tint px-6 py-5">
      <h2 id={headingId} className="font-bold text-brand">
        {ui.feedback.levelCard}
      </h2>
      <p className="mt-1 text-sm">{ui.feedback.levelCardText}</p>
      <div onInput={() => setSaved(false)}>
        <NoteForm note={() => ({ scope: "level", refId: levelId })} saveLabel={ui.feedback.save} onSaved={() => setSaved(true)} />
      </div>
      <p role="status" className="mt-2 text-sm text-ok">
        {saved ? ui.feedback.saved : ""}
      </p>
    </section>
  );
}

/**
 * *Segnala un problema* (SPEC §3.1, §10.6) with its dialog, a native modal:
 * a textarea that saves a `scope = lesson` note on the page I'm on
 * (`a2.u01.l02/esercizi/4`). Escape or *Annulla* closes it and saves nothing,
 * and the next opening starts empty;
 * *Invia* saves and says so. `onClose` runs whenever the dialog closes, for
 * returning focus. Returns the function that opens it, and the dialog to render.
 */
export function useReportDialog({ lessonId, lessonPath, onClose }: { lessonId: string; lessonPath: string; onClose?: () => void }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [sent, setSent] = useState(false);
  // A new form on every opening, so a draft left by Annulla doesn't come back on another page.
  const [opening, setOpening] = useState(0);
  const close = () => dialogRef.current?.close();

  const dialog = (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-xl font-bold text-brand">
        {ui.feedback.report}
      </h2>
      {sent ? (
        <>
          <p role="status" className="mt-3 text-ok">
            {ui.feedback.sent}
          </p>
          <div className="mt-6 flex justify-end">
            <button type="button" autoFocus onClick={close} className={OUTLINE_CLASS}>
              {ui.feedback.close}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3">{ui.feedback.reportText}</p>
          <NoteForm
            key={opening}
            note={() => ({ scope: "lesson", refId: lessonNoteRef(lessonId, lessonPath, pathname) })}
            saveLabel={ui.feedback.send}
            onSaved={() => setSent(true)}
          >
            <button type="button" onClick={close} className={OUTLINE_CLASS}>
              {ui.feedback.cancel}
            </button>
          </NoteForm>
        </>
      )}
    </dialog>
  );

  return {
    open: () => {
      setSent(false);
      setOpening((count) => count + 1);
      dialogRef.current?.showModal();
    },
    dialog,
  };
}
