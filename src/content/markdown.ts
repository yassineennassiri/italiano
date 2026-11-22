/**
 * The small Markdown subset of grammar text, example sentences and the culture
 * page (SPEC §9.1): paragraphs, `**bold**` and `*italic*`. A step `reading`
 * adds a heading, subheads and lists (SPEC §5.2.7). Pure, so it renders on the
 * server without a Markdown library.
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

/** One block of a step `reading` document (SPEC §5.2.7). */
export type DocumentBlock =
  | { kind: "heading" | "subhead" | "paragraph"; spans: Span[] }
  | { kind: "list"; items: Span[][] };

/** `# Heading`, `## Subhead` (deeper levels too) or `- list item`, with its text. */
const BLOCK_MARKER = /^(#{1,6}|-)\s+(.*)$/;

/**
 * A step `reading` as blocks: `# heading`, `## subheads`, `- list` items and
 * paragraphs. A blank line or a marked line ends a paragraph; the lines of one
 * paragraph join with a space.
 */
export function parseDocument(md: string): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  let paragraph: string[] = [];
  const endParagraph = () => {
    if (paragraph.length > 0) blocks.push({ kind: "paragraph", spans: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  for (const raw of md.split("\n")) {
    const line = raw.trim();
    const marker = BLOCK_MARKER.exec(line);
    if (line === "" || marker) endParagraph();
    if (line === "") continue;
    if (!marker) {
      paragraph.push(line);
      continue;
    }
    const [, mark, text] = marker;
    const spans = parseInline(text);
    const previous = blocks.at(-1);
    if (mark !== "-") blocks.push({ kind: mark === "#" ? "heading" : "subhead", spans });
    else if (previous?.kind === "list") previous.items.push(spans);
    else blocks.push({ kind: "list", items: [spans] });
  }
  endParagraph();
  return blocks;
}
