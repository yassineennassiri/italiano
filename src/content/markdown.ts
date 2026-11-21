/**
 * The small Markdown subset of grammar text, example sentences and the culture
 * page (SPEC §9.1): paragraphs, `**bold**` and `*italic*`. Pure, so it renders
 * on the server without a Markdown library.
 */

/** A run of text with one style. */
export type Span = { text: string; bold?: true; italic?: true };

/** `**bold**` or `*italic*`, never spanning a line. */
const EMPHASIS = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;

/** One line of text as styled runs: `Sì: **la** valigia` → "Sì: ", bold "la", " valigia". */
export function parseInline(text: string): Span[] {
  const spans: Span[] = [];
  let last = 0;
  for (const match of text.matchAll(EMPHASIS)) {
    if (match.index > last) spans.push({ text: text.slice(last, match.index) });
    const [, bold, italic] = match;
    spans.push(bold !== undefined ? { text: bold, bold: true } : { text: italic!, italic: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans;
}

/** Paragraphs (split on blank lines; the lines of one paragraph join with a space), each as styled runs. */
export function parseMarkdown(md: string): Span[][] {
  return md
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim().replace(/\s*\n\s*/g, " "))
    .filter((paragraph) => paragraph !== "")
    .map(parseInline);
}
