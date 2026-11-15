import { notFound } from "next/navigation";
import { Suspense } from "react";
import { type ContentPage, hasPage } from "@/content/lesson-nav";
import { ui } from "@/ui-it";
import { type LessonRouteParams, lessonFromParams } from "./lesson-params";

type StubParams = Promise<LessonRouteParams & { n?: string }>;

/**
 * A lesson page that later issues fill in (Risultati, Grammatica, …): the
 * lesson bar, a heading and In arrivo. No breadcrumb (SPEC §3.1). A `page`
 * the lesson doesn't have (no culture, grammar page 9) goes to the 404.
 */
export function StubPage({ params, heading, page }: { params: StubParams; heading: string; page?: ContentPage }) {
  return (
    <Suspense fallback={null}>
      <Stub params={params} heading={heading} page={page} />
    </Suspense>
  );
}

async function Stub({ params, heading, page }: { params: StubParams; heading: string; page?: ContentPage }) {
  const lesson = await lessonFromParams(params);
  if (page && !hasPage(lesson, page, (await params).n)) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand">{heading}</h1>
      <p className="mt-4 text-muted">{ui.comingSoon}</p>
    </div>
  );
}
