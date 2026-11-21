"use client";

import { useRouter } from "next/navigation";
import { useId, useRef } from "react";
import { progressQueue, submitReset } from "@/progress/client";
import type { ResetTarget } from "@/progress/plan";
import { ui } from "@/ui-it";

/** Reloads the page's server data once every queued write has landed, after a retry if need be. */
function refreshWhenSaved(refresh: () => void): void {
  const unsubscribe = progressQueue.subscribe(() => {
    if (progressQueue.status !== "saved") return;
    unsubscribe();
    refresh();
  });
  if (progressQueue.status === "saved") {
    unsubscribe();
    refresh();
  }
}

/**
 * Azzera (SPEC §4.10) with its confirmation dialog, a native modal: Escape or
 * *Annulla* closes it and changes nothing. *Azzera* shows the target's
 * exercises as untouched at once, then reloads the page's server data (status
 * circles, scores) once the reset has landed. `onClose` runs whenever the
 * dialog closes, for returning focus. Returns the function that opens it, and
 * the dialog to render.
 */
export function useResetDialog({ target, title, onClose }: { target: ResetTarget; title: string; onClose?: () => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const textId = useId();
  const lesson = target.scope === "lesson";

  const confirm = () => {
    dialogRef.current?.close();
    submitReset(target);
    refreshWhenSaved(() => router.refresh());
  };

  const dialog = (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={textId}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-lg p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-xl font-bold text-brand">
        {lesson ? ui.reset.lessonQuestion : ui.reset.levelQuestion}
      </h2>
      <div id={textId} className="mt-3 space-y-2">
        <p>{lesson ? ui.reset.lessonText(title) : ui.reset.levelText(title)}</p>
        <p className="text-sm text-muted">{ui.reset.keptText}</p>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          autoFocus
          onClick={() => dialogRef.current?.close()}
          className="rounded-full border-2 border-brand px-6 py-2 font-bold text-brand hover:bg-tint"
        >
          {ui.reset.cancel}
        </button>
        <button type="button" onClick={confirm} className="rounded-full bg-bad px-6 py-2 font-bold text-white hover:brightness-95">
          {ui.reset.confirm}
        </button>
      </div>
    </dialog>
  );

  return { open: () => dialogRef.current?.showModal(), dialog };
}

/** The level overview's *Azzera* button with its dialog (SPEC §3.3). */
export function LevelResetButton({ levelId, levelTitle }: { levelId: string; levelTitle: string }) {
  const reset = useResetDialog({ target: { scope: "level", levelId }, title: levelTitle });
  return (
    <>
      <button
        type="button"
        onClick={reset.open}
        className="rounded-full border-2 border-brand px-4 py-1 text-sm font-bold text-brand hover:bg-tint"
      >
        {ui.reset.levelButton}
      </button>
      {reset.dialog}
    </>
  );
}
