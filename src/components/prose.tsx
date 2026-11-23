import { parseInline, parseMarkdown, type Span } from "@/content/markdown";
import { LinkedText } from "./linked-text";

/** Styled runs: **bold** as <strong>, *italic* as <em>; vocab links (a reading's) as links. */
export function InlineText({ spans }: { spans: readonly Span[] }) {
  return spans.map((span, index) => {
    const text = <LinkedText text={span.text} />;
    if (span.bold) return <strong key={index}>{text}</strong>;
    if (span.italic) return <em key={index}>{text}</em>;
    return <span key={index}>{text}</span>;
  });
}

/** One line of content Markdown, inline (`**bold**`, `*italic*`). */
export function InlineMarkdown({ text }: { text: string }) {
  return <InlineText spans={parseInline(text)} />;
}

/** Content Markdown as paragraphs: grammar text and the culture page (SPEC §9.1). Their prose is English. */
export function Prose({ md, className = "" }: { md: string; className?: string }) {
  return (
    <div lang="en" className={`space-y-4 leading-relaxed ${className}`}>
      {parseMarkdown(md).map((spans, index) => (
        <p key={index}>
          <InlineText spans={spans} />
        </p>
      ))}
    </div>
  );
}
