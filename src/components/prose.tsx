import { parseInline, parseMarkdown, type Span } from "@/content/markdown";

/** Styled runs: **bold** as <strong>, *italic* as <em>. */
export function InlineText({ spans }: { spans: readonly Span[] }) {
  return spans.map((span, index) => {
    if (span.bold) return <strong key={index}>{span.text}</strong>;
    if (span.italic) return <em key={index}>{span.text}</em>;
    return <span key={index}>{span.text}</span>;
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
