import type { LessonStatus } from "@/scoring/lesson";
import { ui } from "@/ui-it";

/**
 * The status circle on lesson cards and the level overview (SPEC §3.3): empty,
 * half-filled, or filled with a tick. The tooltip names the state.
 */
export function StatusCircle({
  status,
  bestPercent,
  label,
}: {
  status: LessonStatus;
  bestPercent?: number;
  /** Overrides the tooltip; the level circle uses this. */
  label?: string;
}) {
  const text = label ?? ui.lessonStatus(status, bestPercent);
  return (
    <span title={text} className="inline-flex shrink-0">
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="10" fill="#ffffff" stroke="var(--brand)" strokeWidth="1.5" />
        {status === "in_progress" && <path d="M12 2 A10 10 0 0 1 12 22 Z" fill="var(--brand)" />}
        {status === "completed" && (
          <>
            <circle cx="12" cy="12" r="10" fill="var(--brand)" />
            <path d="M7 12.5 L10.5 16 L17 9" fill="none" stroke="#ffffff" strokeWidth="2" />
          </>
        )}
      </svg>
      <span className="sr-only">{text}</span>
    </span>
  );
}
