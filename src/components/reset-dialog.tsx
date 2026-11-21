"use client";

import { useRouter } from "next/navigation";
import { type RefObject, useId, useRef } from "react";
import type { ResetTarget } from "@/progress/plan";
import { progressQueue, submitReset } from "@/progress/client";
import { ui } from "@/ui-it";

/**
 * Azzera's confirmation dialog (SPEC §4.10), a native modal: Escape or
 * *Annulla* closes it and changes nothing. *Azzera* clears the target's
 * exercises at once, then reloads the page's saved data once the reset lands.
 * `useResetDialog` gives its ref and the function that opens it.
 */
export function ResetDialog({
  target,
  question,
  text,
  dialogRef,
}: {
  target: ResetTarget;
  question: string;
  text: string;
  dialogRef: RefObject<HTMLDialogElement | null>;
}) {
  const router = useRouter();
  const titleId = useId();
  const textId = useId();

  const confirm = async () => {
    dialogRef.current?.close();
    submitReset(target);
    // Status circles, scores and resume points are read on the server: reload them once the reset has landed.
    if ((await progressQueue.settled()) === "saved") router.refresh();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={textId}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-lg p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-xl font-bold text-brand">
        {question}
      </h2>
      <div id={textId} className="mt-3 space-y-2">
        <p>{text}</p>
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
        <button type="button" onClick={() => void confirm()} className="rounded-full bg-bad px-6 py-2 font-bold text-white hover:brightness-95">
          {ui.reset.confirm}
        </button>
      </div>
    </dialog>
  );
}

/** A ref for `ResetDialog` and the function that opens it. */
export function useResetDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return { dialogRef, open: () => dialogRef.current?.showModal() };
}

/** The level overview's *Azzera* button with its dialog (SPEC §3.3). */
export function LevelResetButton({ levelId, levelTitle }: { levelId: string; levelTitle: string }) {
  const { dialogRef, open } = useResetDialog();
  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded-full border-2 border-brand px-4 py-1 text-sm font-bold text-brand hover:bg-tint"
      >
        {ui.reset.levelButton}
      </button>
      <ResetDialog
        target={{ scope: "level", levelId }}
        question={ui.reset.levelQuestion}
        text={ui.reset.levelText(levelTitle)}
        dialogRef={dialogRef}
      />
    </>
  );
}
