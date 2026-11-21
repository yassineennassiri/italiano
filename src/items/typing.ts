/** Typing into a gap with the Italian character helper (SPEC §5.1). */

/** The palette's characters, in order. */
export const ITALIAN_CHARACTERS = ["à", "è", "é", "ì", "ò", "ù", "À", "È"] as const;

/**
 * `character` typed into `value` with the selection `start`–`end` (an input's
 * selectionStart / selectionEnd): it replaces any selected text, or is appended
 * when there is no cursor. Returns the new value and where the cursor goes.
 */
export function insertAt(value: string, start: number | null, end: number | null, character: string): { value: string; cursor: number } {
  const from = start ?? value.length;
  const to = end ?? from;
  return { value: value.slice(0, from) + character + value.slice(to), cursor: from + character.length };
}
