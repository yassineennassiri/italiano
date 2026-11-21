/** The vocabulary page's list (SPEC §4.6). Pure, so the order is tested without a browser. */
import type { VocabEntry } from "./schema";

/** A leading article: il, lo, la, i, gli, le, un, uno, una, and the elided l', un'. */
const ARTICLE = /^(?:(?:il|lo|la|i|gli|le|un|uno|una)\s+|(?:l|un)['’])/i;

/** What an entry sorts by: its `sort_key`, or its headword without the article (`la valigia` → `valigia`). */
function sortKey(entry: VocabEntry): string {
  return entry.sort_key ?? entry.it.replace(ARTICLE, "");
}

const collator = new Intl.Collator("it", { sensitivity: "base" });

/** The entries in alphabetical order, ignoring the article unless `sort_key` says otherwise. A new array. */
export function sortVocab(entries: readonly VocabEntry[]): VocabEntry[] {
  return [...entries].sort((a, b) => collator.compare(sortKey(a), sortKey(b)));
}
