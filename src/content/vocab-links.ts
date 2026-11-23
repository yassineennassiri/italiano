/**
 * Vocab links (SPEC §4.3, §9.1, CONTEXT.md): `[[word|v-id]]` inside prompts,
 * script lines, readings and gap text links `word` to the lesson's vocab entry
 * `v-id`. Pages render them as dotted links with a popover; speech, subtitles
 * and the content hash use the plain word (ADR-0006).
 */

import { GAP_MARKER as GAP_MARKERS } from "./gap-text";

/** One gap marker anywhere in a string (not global, so `test` keeps no state). */
const GAP_MARKER = new RegExp(GAP_MARKERS.source);

/** A vocab link; group 1 is the shown word, group 2 the vocab id. */
const VOCAB_LINK = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;

/** The text with every `[[word|v-id]]` replaced by `word`. */
export function plainVocabLinks(text: string): string {
  return text.replace(VOCAB_LINK, "$1");
}

export type VocabLinkPiece = { text: string } | { word: string; vocabId: string };

/** The text split into plain runs and vocab links, in order; empty runs are left out. */
export function splitVocabLinks(text: string): VocabLinkPiece[] {
  const pieces: VocabLinkPiece[] = [];
  let last = 0;
  for (const match of text.matchAll(VOCAB_LINK)) {
    if (match.index > last) pieces.push({ text: text.slice(last, match.index) });
    pieces.push({ word: match[1], vocabId: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last) });
  return pieces;
}

/** The lesson's vocab entries that its vocab links point at: what a page needs for the popovers. */
export function linkedVocab<Entry extends { id: string }>(lesson: { vocab: readonly Entry[] }): Entry[] {
  const ids = new Set<string>();
  walkStrings(lesson, [], (text) => {
    for (const match of text.matchAll(VOCAB_LINK)) ids.add(match[2]);
  });
  return lesson.vocab.filter((entry) => ids.has(entry.id));
}

type Path = PropertyKey[];

function walkStrings(value: unknown, path: Path, visit: (text: string, path: Path) => void) {
  if (typeof value === "string") visit(value, path);
  else if (Array.isArray(value)) value.forEach((field, i) => walkStrings(field, [...path, i], visit));
  else if (value && typeof value === "object") {
    for (const [key, field] of Object.entries(value)) walkStrings(field, [...path, key], visit);
  }
}

/** Item fields that hold or reveal answers: a link there would give the answer away. */
const ANSWER_FIELDS = new Set<PropertyKey>(["options", "tiles", "bank", "gaps", "accept"]);

/** The item field a path is in (`["steps", s, "items", i, field, …]`), or undefined outside items. */
const itemField = (path: Path): PropertyKey | undefined =>
  path[0] === "steps" && path[2] === "items" ? path[4] : undefined;

/** Where links may go: prompts, scene and script lines, readings and gap text (SPEC §4.3). */
function linkAllowed(path: Path): boolean {
  const field = path.at(-1);
  const depth = path.length;
  if (path[0] === "scene") return path[1] === "lines" && depth === 4 && field === "it";
  if (path[0] !== "steps") return false;
  if (depth === 3) return field === "reading";
  if (path[2] === "script") return depth === 5 && field === "it";
  return itemField(path) !== undefined && depth === 5 && (field === "prompt" || field === "text");
}

export type VocabLinkProblem = { path: Path; message: string };

/**
 * `content:check`'s vocab-link rules (SPEC §9.1): links are well formed, sit
 * only where they are allowed (never in options, tiles or answers, and outside
 * gaps), and point at an entry in the same lesson's vocab.
 */
export function vocabLinkProblems(lesson: { vocab: readonly { id: string }[] }): VocabLinkProblem[] {
  const vocabIds = new Set(lesson.vocab.map((entry) => entry.id));
  const problems: VocabLinkProblem[] = [];
  walkStrings(lesson, [], (text, path) => {
    const links = [...text.matchAll(VOCAB_LINK)];
    if (/\[\[|\]\]/.test(text.replace(VOCAB_LINK, ""))) {
      problems.push({ path, message: "malformed vocab link: write [[word|v-id]]" });
    }
    if (links.length === 0) return;
    const field = itemField(path);
    if (field !== undefined && ANSWER_FIELDS.has(field)) {
      problems.push({ path, message: "a vocab link here would give the answer away" });
    } else if (!linkAllowed(path)) {
      problems.push({ path, message: "vocab links are allowed only in prompts, script lines, readings and gap text" });
    } else if (links.some(([, word]) => GAP_MARKER.test(word))) {
      problems.push({ path, message: "a vocab link must sit outside the gaps" });
    } else {
      for (const [, , vocabId] of links) {
        if (!vocabIds.has(vocabId)) problems.push({ path, message: `vocab link "${vocabId}" is not in this lesson's vocab` });
      }
    }
  });
  return problems;
}
