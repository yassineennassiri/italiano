import Link from "next/link";
import type { ErrorTag } from "@/content/load";
import type { Note } from "@/content/schema";
import { ui } from "@/ui-it";

const ICON_PATHS: Record<Note["kind"], string> = {
  info: "M12 11 V17 M12 7.5 V8",
  tip: "M9 17 H15 M10 20 H14 M12 4 A5 5 0 0 1 15 13 V15 H9 V13 A5 5 0 0 1 12 4 Z",
  new_words: "M6 6 H18 M6 10 H18 M6 14 H14",
  attenzione: "M12 7 V13 M12 16.5 V17",
};

/**
 * One note under an item (SPEC §4.3): a round icon, the Italian label and the
 * English text. An Attenzione! note links to the page that teaches its error tag.
 */
export function NoteRow({ note, errorTag }: { note: Note; errorTag?: ErrorTag }) {
  const warning = note.kind === "attenzione";
  return (
    <p className="flex items-start gap-3 text-sm">
      <svg
        viewBox="0 0 24 24"
        className={`mt-0.5 size-5 shrink-0 rounded-full text-white ${warning ? "bg-bad" : "bg-brand"}`}
        aria-hidden="true"
        focusable="false"
      >
        <path d={ICON_PATHS[note.kind]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>
        <strong>{ui.lesson.notes[note.kind]}</strong> <span lang="en">{note.text_en}</span>
        {errorTag?.href && (
          <>
            {" "}
            <Link href={errorTag.href} className="font-semibold text-brand underline">
              {ui.lesson.noteRule}
            </Link>
          </>
        )}
      </span>
    </p>
  );
}
