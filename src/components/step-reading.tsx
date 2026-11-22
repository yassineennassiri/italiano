import { type DocumentBlock, parseDocument } from "@/content/markdown";
import type { ReadingLayout } from "@/content/reading";
import { InlineText } from "./prose";

/**
 * A step's `reading` (SPEC §4.2 item 6): a plain intro paragraph, or a
 * document on a tinted panel with its heading, subheads, paragraphs and lists
 * (SPEC §5.2.7). Italian, like the page.
 */
export function StepReading({ md, layout }: { md: string; layout: ReadingLayout }) {
  const blocks = parseDocument(md).map((block, index) => <ReadingBlock key={index} block={block} />);
  if (layout === "intro") return <div className="mt-6 space-y-3 text-lg leading-relaxed text-brand">{blocks}</div>;
  return <article className="mt-6 space-y-4 rounded-lg bg-tint px-6 py-6 leading-relaxed text-brand">{blocks}</article>;
}

function ReadingBlock({ block }: { block: DocumentBlock }) {
  switch (block.kind) {
    case "heading":
      return (
        <h2 className="text-xl font-bold">
          <InlineText spans={block.spans} />
        </h2>
      );
    case "subhead":
      return (
        <h3 className="pt-2 font-bold">
          <InlineText spans={block.spans} />
        </h3>
      );
    case "paragraph":
      return (
        <p>
          <InlineText spans={block.spans} />
        </p>
      );
    case "list":
      return (
        <ul className="list-disc space-y-1 pl-6">
          {block.items.map((spans, index) => (
            <li key={index}>
              <InlineText spans={spans} />
            </li>
          ))}
        </ul>
      );
  }
}
