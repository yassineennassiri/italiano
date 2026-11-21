import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LanternaLogo } from "@/components/lanterna-logo";
import { LevelResetButton } from "@/components/reset-dialog";
import { StatusCircle } from "@/components/status-circle";
import type { LevelId } from "@/content/ids";
import { loadCourse } from "@/content/load";
import { LEVEL_COMPLETED_PARAM, type LessonCard, levelOverview, type UnitGroup } from "@/content/overview";
import { type LessonCircle, levelProgress } from "@/progress/level-progress";
import { readProgressSummaries } from "@/progress/read";
import { ui } from "@/ui-it";

export function generateStaticParams() {
  return loadCourse().levels.map((level) => ({ level: level.id }));
}

export async function generateMetadata({ params }: PageProps<"/[level]">): Promise<Metadata> {
  const overview = levelOverview((await params).level);
  return overview ? { title: ui.level.pageTitle(overview.title) } : {};
}

/** The level overview (SPEC §3.3): hero, level status, unit groups and lesson cards with their status circles. */
export default function LevelPage({ params, searchParams }: PageProps<"/[level]">) {
  // The params read sits behind Suspense, so the shared App Shell stays URL-independent.
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Suspense fallback={<div className="h-44 sm:h-auto sm:aspect-[16/7] rounded-lg bg-tint" />}>
        <LevelOverviewView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LevelOverviewView({ params, searchParams }: Pick<PageProps<"/[level]">, "params" | "searchParams">) {
  const overview = levelOverview((await params).level);
  if (!overview) notFound();
  const progress = levelProgress(overview.id, await readProgressSummaries())!;
  // Avanti on the Finish screen of the level's last lesson (SPEC §4.9).
  const levelCompleted = (await searchParams)[LEVEL_COMPLETED_PARAM] !== undefined;

  return (
    <>
      <Hero levelId={overview.id} title={overview.title} />

      {levelCompleted && (
        <p role="status" className="mt-4 rounded-lg bg-accent px-6 py-4 text-center text-xl font-bold text-foreground">
          {ui.level.completed}
        </p>
      )}

      <div className="mt-3 flex items-center justify-end gap-2 px-2">
        <LevelResetButton levelId={overview.id} levelTitle={overview.title} />
        <span className="text-sm text-muted">{ui.percent(progress.percent)}</span>
        <StatusCircle status={progress.status} label={ui.level.levelStatus(progress.status, progress.percent)} />
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-x-0 gap-y-8 md:grid-cols-3">
        {overview.units.map((unit, index) => (
          <li key={unit.id}>
            <UnitColumn unit={unit} tinted={index % 2 === 0} circles={progress.lessons} />
          </li>
        ))}
      </ul>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3">
        <div aria-disabled="true" className="border-t border-line bg-white px-6 py-5 text-muted">
          <p className="font-bold">{ui.level.finalTest}</p>
          <p className="mt-1 text-sm">{ui.comingSoon}</p>
        </div>
      </div>
    </>
  );
}

function Hero({ levelId, title }: { levelId: LevelId; title: string }) {
  return (
    <div className="relative flex h-44 sm:h-auto sm:aspect-[16/7] items-end overflow-hidden rounded-lg bg-gradient-to-b from-brand-light to-brand p-4 sm:p-8">
      {/* Placeholder illustration until the real one exists: the sea and the hills of Genoa. */}
      <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-1/2 w-full" aria-hidden="true">
        <path d="M0 60 Q60 20 120 50 T240 40 T400 50 V120 H0 Z" fill="#ffffff" opacity="0.15" />
        <path d="M0 90 Q100 75 200 90 T400 88 V120 H0 Z" fill="#ffffff" opacity="0.25" />
      </svg>
      <span className="absolute left-4 top-4 flex size-16 items-center justify-center rounded-full bg-white text-2xl font-bold text-brand shadow sm:left-8 sm:top-8 sm:size-24 sm:text-4xl">
        {ui.levelBadge(levelId)}
      </span>
      <span className="absolute right-4 top-4 flex size-16 items-center justify-center rounded-full bg-white shadow sm:right-8 sm:top-8 sm:size-28">
        <LanternaLogo className="h-11 w-9 sm:h-20 sm:w-16" />
      </span>
      <h1 className="relative text-2xl font-bold text-white drop-shadow sm:text-4xl">{title}</h1>
    </div>
  );
}

function UnitColumn({ unit, tinted, circles }: { unit: UnitGroup; tinted: boolean; circles: ReadonlyMap<string, LessonCircle> }) {
  return (
    <section aria-labelledby={`${unit.id}-heading`}>
      <h2 id={`${unit.id}-heading`} className="border-b border-line px-6 pb-3 text-lg text-panel">
        {unit.number} {unit.title}
      </h2>
      {unit.lessons.length === 0 ? (
        <div aria-disabled="true" className={`px-6 py-5 text-muted ${tinted ? "bg-tint" : "bg-white"}`}>
          {ui.comingSoon}
        </div>
      ) : (
        <ul>
          {unit.lessons.map((lesson, index) => (
            <li key={lesson.id}>
              <LessonCardView lesson={lesson} tinted={tinted === (index % 2 === 0)} circle={circles.get(lesson.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LessonCardView({ lesson, tinted, circle }: { lesson: LessonCard; tinted: boolean; circle?: LessonCircle }) {
  return (
    <Link
      href={lesson.href}
      className={`flex items-start justify-between gap-3 border-b border-line px-6 py-5 hover:bg-tint-strong ${tinted ? "bg-tint" : "bg-white"}`}
    >
      <span className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-bold text-brand">{lesson.title}</span>
          {lesson.draft && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-foreground">{ui.draft}</span>
          )}
        </span>
        <span>{lesson.topic}</span>
        {lesson.grammarLabel && <span>{lesson.grammarLabel}</span>}
      </span>
      <StatusCircle status={circle?.status ?? "not_started"} bestPercent={circle?.bestPercent} />
    </Link>
  );
}
