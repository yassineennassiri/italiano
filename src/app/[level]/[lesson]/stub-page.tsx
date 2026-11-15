import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Lesson } from "@/content/schema";
import { ui } from "@/ui-it";
import { lessonFromParams } from "./lesson-params";

type StubParams = Promise<{ level: string; lesson: string; n?: string }>;

/**
 * A lesson page that later issues fill in (Risultati, Grammatica, …): the
 * lesson bar, a heading and In arrivo. No breadcrumb (SPEC §3.1). `exists`
 * sends a page the lesson doesn't have (no culture, grammar page 9) to the 404.
 */
export function StubPage({
  params,
  heading,
  exists = () => true,
}: {
  params: StubParams;
  heading: string;
  exists?: (lesson: Lesson, n: string | undefined) => boolean;
}) {
  return (
    <Suspense fallback={null}>
      <Stub params={params} heading={heading} exists={exists} />
    </Suspense>
  );
}

async function Stub({
  params,
  heading,
  exists,
}: {
  params: StubParams;
  heading: string;
  exists: (lesson: Lesson, n: string | undefined) => boolean;
}) {
  const lesson = await lessonFromParams(params);
  if (!exists(lesson, (await params).n)) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand">{heading}</h1>
      <p className="mt-4 text-muted">{ui.comingSoon}</p>
    </div>
  );
}
