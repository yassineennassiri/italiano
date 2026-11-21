import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GrammarBlockView, TermsPanel } from "@/components/grammar-blocks";
import { ReviewFrame } from "@/components/review-frame";
import { loadLessonBySlug } from "@/content/load";
import { pageNumber, reviewNav } from "@/content/lesson-nav";
import type { GrammarBlockOf } from "@/content/schema";
import { ui } from "@/ui-it";
import { type LessonRouteParams, lessonFromParams } from "../../lesson-params";

export function generateStaticParams({ params }: { params: LessonRouteParams }) {
  const lesson = loadLessonBySlug(params.level, params.lesson);
  return (lesson?.grammar ?? []).map((_, index) => ({ n: String(index + 1) }));
}

/**
 * Grammar page n (SPEC §4.5): a narrow illustrated article (title, examples,
 * form tables, English rules, rule images), then the terms panel full width.
 */
export default function GrammarPage({ params }: PageProps<"/[level]/[lesson]/grammatica/[n]">) {
  return (
    <Suspense fallback={null}>
      <Grammar params={params} />
    </Suspense>
  );
}

async function Grammar({ params }: Pick<PageProps<"/[level]/[lesson]/grammatica/[n]">, "params">) {
  const lesson = await lessonFromParams(params);
  const number = pageNumber((await params).n, lesson.grammar.length) ?? notFound();
  const page = lesson.grammar[number - 1];
  const terms = page.blocks.filter((block): block is GrammarBlockOf<"terms"> => block.kind === "terms");
  return (
    <ReviewFrame heading={ui.lesson.grammar} nav={reviewNav(lesson, "grammatica", number)}>
      <article className="mx-auto max-w-2xl px-4 py-8">
        <h2 className="text-2xl font-bold text-brand">{page.title}</h2>
        <div className="mt-6 space-y-6">
          {page.blocks.map((block, index) => (block.kind === "terms" ? null : <GrammarBlockView key={index} block={block} />))}
        </div>
      </article>
      <TermsPanel blocks={terms} />
    </ReviewFrame>
  );
}
