import type { GrammarBlock, GrammarBlockOf as Block } from "@/content/schema";
import { ui } from "@/ui-it";
import { MediaFrame } from "./media-frame";
import { InlineMarkdown, Prose } from "./prose";
import { RuleImage } from "./rule-image";

/** One block of a grammar page's article (SPEC §4.5, §9.1). `terms` blocks go in `TermsPanel` instead. */
export function GrammarBlockView({ block }: { block: Exclude<GrammarBlock, { kind: "terms" }> }) {
  switch (block.kind) {
    case "text":
      return <Prose md={block.md} />;
    case "example":
      return <Example block={block} />;
    case "table":
      return <FormTable block={block} />;
    case "rule":
      return (
        <div className="flex justify-center">
          <RuleImage rule={block} />
        </div>
      );
  }
}

/** An illustration with an example sentence from the scene: the target form in bold, the sentence in italics. */
function Example({ block }: { block: Block<"example"> }) {
  return (
    <figure>
      {block.image && <MediaFrame src={block.image} alt={ui.lesson.exampleImageAlt} />}
      <figcaption className="mt-3 text-center">
        <p className="text-lg italic">
          <InlineMarkdown text={block.it} />
        </p>
        {block.en && (
          <p lang="en" className="mt-1 text-sm text-muted">
            {block.en}
          </p>
        )}
      </figcaption>
    </figure>
  );
}

/** The compact form table, e.g. before a vowel · masculine · l'ombrello. */
function FormTable({ block }: { block: Block<"table"> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-2 border-brand">
            {block.columns.map((column, index) => (
              <th key={index} scope="col" className="px-3 py-2 font-bold text-brand">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r} className="border-b border-line even:bg-tint">
              {row.map((cell, c) => (
                <td key={c} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The terms panel: metalanguage definitions, full width at the page bottom, ruled top and bottom. */
export function TermsPanel({ blocks }: { blocks: readonly Block<"terms">[] }) {
  const items = blocks.flatMap((block) => block.items);
  if (items.length === 0) return null;
  return (
    <section className="mt-10 border-y-2 border-line bg-tint py-6">
      <dl lang="en" className="mx-auto max-w-2xl space-y-3 px-4 text-sm">
        {items.map((item) => (
          <div key={item.term}>
            <dt className="font-bold text-brand">{item.term}</dt>
            <dd>{item.def_en}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
