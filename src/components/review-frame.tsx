import Link from "next/link";
import type { ReactNode } from "react";
import type { ReviewNav } from "@/content/lesson-nav";
import { ui } from "@/ui-it";
import { AccentLink } from "./accent-link";

/**
 * A page of the review sequence (SPEC §4): a header strip with its heading and
 * the ‹ › arrows of the whole sequence (each hidden at its end), the page, then
 * Avanti, or *Finisci la lezione!* on the last review page.
 */
export function ReviewFrame({ heading, nav, children }: { heading: string; nav: ReviewNav; children: ReactNode }) {
  return (
    <>
      <div className="border-b border-line bg-tint">
        <div className="mx-auto grid h-14 max-w-3xl grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 px-4">
          {nav.previousHref ? <ArrowLink href={nav.previousHref} direction="previous" /> : <span />}
          <h1 className="text-center text-xl font-bold text-brand">{heading}</h1>
          {nav.finishes ? <span /> : <ArrowLink href={nav.nextHref} direction="next" />}
        </div>
      </div>
      {children}
      <div className="pt-4 pb-12 text-center">
        <AccentLink href={nav.nextHref}>{nav.finishes ? ui.lesson.finishLesson : ui.lesson.next}</AccentLink>
      </div>
    </>
  );
}

function ArrowLink({ href, direction }: { href: string; direction: "previous" | "next" }) {
  return (
    <Link
      href={href}
      rel={direction === "previous" ? "prev" : "next"}
      aria-label={direction === "previous" ? ui.lesson.previousPage : ui.lesson.nextPage}
      className="inline-flex size-10 items-center justify-center rounded-full text-brand hover:bg-tint-strong"
    >
      <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true" focusable="false">
        <path
          d={direction === "previous" ? "M15 5 L8 12 L15 19" : "M9 5 L16 12 L9 19"}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
