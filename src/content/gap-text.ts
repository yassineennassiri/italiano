/** Item text with `{{g1}}` gap markers (dropdown, text_gap, word_bank, audio_gap). */

/** A gap marker; group 1 is the gap id. Global, so use it with `matchAll` / `split`. */
export const GAP_MARKER = /\{\{([^}]+)\}\}/g;

export type GapTextPiece = { text: string } | { gap: string };

/** The text split into plain text and gaps, in order; empty pieces are left out. */
export function splitGapText(text: string): GapTextPiece[] {
  // With a capture group, split alternates text and gap ids: text, id, text, id, …, text.
  return text
    .split(GAP_MARKER)
    .map((piece, index): GapTextPiece => (index % 2 === 1 ? { gap: piece } : { text: piece }))
    .filter((piece) => !("text" in piece) || piece.text !== "");
}
