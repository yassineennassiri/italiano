import type { Metadata } from "next";
import { Suspense } from "react";
import { LessonMenu } from "@/components/lesson-menu";
import { lessonMenu } from "@/content/lesson-nav";
import { ui } from "@/ui-it";
import { allLessonParams, type LessonParams, lessonFromParams } from "./lesson-params";

export function generateStaticParams() {
  return allLessonParams();
}

export async function generateMetadata({ params }: LayoutProps<"/[level]/[lesson]">): Promise<Metadata> {
  return { title: ui.lesson.pageTitle((await lessonFromParams(params)).title) };
}

/** Every lesson page: the sticky lesson bar with the lesson menu (SPEC §3.1), then the page. */
export default function LessonLayout({ params, children }: LayoutProps<"/[level]/[lesson]">) {
  return (
    <>
      <div className="sticky top-16 z-10 bg-brand-light">
        <Suspense fallback={<div className="h-14" />}>
          <LessonBar params={params} />
        </Suspense>
      </div>
      {children}
    </>
  );
}

async function LessonBar({ params }: { params: LessonParams }) {
  const lesson = await lessonFromParams(params);
  return (
    <div className="mx-auto grid h-14 max-w-6xl grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 px-4">
      <span />
      <p className="truncate text-center text-xl font-bold text-white">{lesson.title}</p>
      <LessonMenu entries={lessonMenu(lesson)} />
    </div>
  );
}
