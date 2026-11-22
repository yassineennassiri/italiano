/**
 * Vocab links (SPEC §9.1, CONTEXT.md): `[[word|v-id]]` inside prompts, script
 * lines, readings and gap text links `word` to the lesson's vocab entry `v-id`.
 * Until the popovers exist, links show as their plain word.
 */

/** A vocab link; group 1 is the shown word, group 2 the vocab id. Global, so use it with `replace` / `matchAll`. */
export const VOCAB_LINK = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;

/** The text with every `[[word|v-id]]` replaced by `word`. */
export function plainVocabLinks(text: string): string {
  return text.replace(VOCAB_LINK, "$1");
}

/** A copy of JSON content with every string's vocab links turned into plain words. */
export function withPlainVocabLinks<T>(value: T): T {
  if (typeof value === "string") return plainVocabLinks(value) as T;
  if (Array.isArray(value)) return value.map(withPlainVocabLinks) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, withPlainVocabLinks(field)])) as T;
  }
  return value;
}
