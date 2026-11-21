/**
 * Progress for the level overview and Home (SPEC §3.2, §3.3), from the stored
 * lesson summaries. Server-only: it reads the course from disk.
 */
import { loadCourse } from "@/content/load";
import { type LessonStatus, levelPercent, levelStatus } from "@/scoring/lesson";
import type { ProgressSummary } from "./store";

export type LessonBadge = { status: LessonStatus; bestPercent?: number };

export type LevelProgress = {
  /** Completed lessons ÷ planned lessons. */
  percent: number;
  status: LessonStatus;
  /** A lesson's status circle; a lesson missing here is not started. */
  lessons: Map<string, LessonBadge>;
};

/** One level's progress, or undefined for a level the course doesn't have. */
export function levelProgress(levelId: string, summaries: readonly Pick<ProgressSummary, "lessonId" | "status" | "bestPercent">[]): LevelProgress | undefined {
  const level = loadCourse().levels.find((candidate) => candidate.id === levelId);
  if (!level) return undefined;
  const statuses = new Map(summaries.map(({ lessonId, status }) => [lessonId, status]));
  const completed = new Set(summaries.filter(({ status }) => status === "completed").map(({ lessonId }) => lessonId));
  return {
    percent: levelPercent(level, completed),
    status: levelStatus(level, statuses),
    lessons: new Map(
      summaries.map(({ lessonId, status, bestPercent }) => [
        lessonId,
        // A not-started lesson shows no %; the others their best so far.
        status === "not_started" || bestPercent === null ? { status } : { status, bestPercent },
      ]),
    ),
  };
}
