/**
 * Feedback notes (SPEC §10.6): my notes about content to fix, on a level or
 * on a page of a lesson. The writes that save a note and tick *Fatto*, the
 * `ref_id` a lesson note records, and the open notes grouped by lesson for
 * `/feedback` and `npm run feedback:list`. Pure: the store reads and writes the rows.
 */
import { z } from "zod";

/** What a note is about. `item` stays in the schema for per-item notes later; nothing writes it yet. */
export const feedbackScopes = ["level", "lesson", "item"] as const;
export type FeedbackScope = (typeof feedbackScopes)[number];

/** Longer than any note needs; keeps a stray paste out of the database. */
export const MAX_NOTE = 4000;

/** A level id, `a2`. */
const LEVEL_REF = /^(a2|b1|b2)$/;
/** A lesson id plus the page, `a2.u01.l02/esercizi/4`; the page is absent on the lesson's own URL. */
const LESSON_REF = /^(a2|b1|b2)\.u\d{2}\.l\d{2}(\/[a-z0-9-]+)*$/;

/** A new note, as the level overview's card and *Segnala un problema* send it. */
export const feedbackWriteSchema = z
  .strictObject({
    /** Also the note's id, so a retried write is saved once. */
    eventId: z.uuid(),
    /** When I saved it, on my computer. */
    at: z.iso.datetime(),
    scope: z.enum(["level", "lesson"]),
    refId: z.string(),
    text: z.string().trim().min(1).max(MAX_NOTE),
  })
  .refine(({ scope, refId }) => (scope === "level" ? LEVEL_REF : LESSON_REF).test(refId), { path: ["refId"] });
export type FeedbackWrite = z.infer<typeof feedbackWriteSchema>;

/** *Fatto* ticked or unticked on `/feedback`. */
export const feedbackDoneWriteSchema = z.strictObject({ noteId: z.uuid(), done: z.boolean() });
export type FeedbackDoneWrite = z.infer<typeof feedbackDoneWriteSchema>;

/**
 * A lesson note's `ref_id`: the lesson id plus the page I'm on, from the URL.
 * `/a2/la-casa-della-signora-pina/esercizi/4` → `a2.u01.l02/esercizi/4`.
 */
export function lessonNoteRef(lessonId: string, lessonPath: string, pathname: string): string {
  const page = pathname.startsWith(lessonPath) ? pathname.slice(lessonPath.length).replace(/^\/+|\/+$/g, "") : "";
  return page === "" ? lessonId : `${lessonId}/${page}`;
}

/** An open note as `/feedback` and the Markdown list show it. */
export type OpenNote = { id: string; scope: FeedbackScope; refId: string; text: string; createdAt: Date };

/** The open notes of one level or lesson. `id` is the level or lesson id. */
export type NoteGroup = { id: string; title: string; notes: OpenNote[] };

/** The level or lesson a note belongs to: `a2.u01.l02/esercizi/4` → `a2.u01.l02`. */
function groupId(note: OpenNote): string {
  const head = note.refId.split("/")[0];
  // An item ref (later) starts with its lesson id.
  return note.scope === "item" ? (/^.+?\.l\d{2}/.exec(head)?.[0] ?? head) : head;
}

/**
 * The open notes grouped by level and lesson, in course order (a level's own
 * notes before its lessons'), oldest note first. `titleOf` names a level or
 * lesson; a group it can't name, such as a removed lesson, is titled by its id.
 */
export function groupOpenNotes(notes: readonly OpenNote[], titleOf: (id: string) => string | undefined): NoteGroup[] {
  const groups = new Map<string, OpenNote[]>();
  for (const note of notes) {
    const id = groupId(note);
    groups.set(id, [...(groups.get(id) ?? []), note]);
  }
  return [...groups]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, grouped]) => ({
      id,
      title: titleOf(id) ?? id,
      notes: grouped.toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    }));
}


/**
 * The open notes as Markdown, for a content-fixing agent (`npm run
 * feedback:list`): a heading per level or lesson, then one list item per note
 * with its `ref_id` and the day it was written.
 */
export function feedbackMarkdown(groups: readonly NoteGroup[]): string {
  const count = groups.reduce((sum, group) => sum + group.notes.length, 0);
  if (count === 0) return "# Feedback notes: none open\n";
  const lines = [`# Feedback notes: ${count} open`, ""];
  for (const group of groups) {
    lines.push(`## ${group.id}: ${group.title}`, "");
    for (const note of group.notes) {
      const text = note.text.replace(/\n(?=.)/g, "\n  ");
      lines.push(`- \`${note.refId}\` (${note.createdAt.toISOString().slice(0, 10)}): ${text}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
