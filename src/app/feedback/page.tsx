import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackList } from "@/components/feedback-list";
import { readOpenNotes } from "@/progress/read";
import { ui } from "@/ui-it";

export const metadata: Metadata = { title: ui.feedback.pageTitle };

/** The open feedback notes, grouped by lesson, each with *Fatto* (SPEC §3, §10.6). Reached from the hamburger. */
export default function FeedbackPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold text-brand">{ui.feedback.heading}</h1>
      <p className="mt-2">{ui.feedback.intro}</p>
      <Suspense fallback={<p className="mt-6 h-6" />}>
        <OpenNotes />
      </Suspense>
    </div>
  );
}

async function OpenNotes() {
  const { groups, loaded } = await readOpenNotes();
  if (!loaded) return <p className="mt-6 text-bad">{ui.feedback.unreachable}</p>;
  if (groups.length === 0) return <p className="mt-6">{ui.feedback.none}</p>;
  return <FeedbackList groups={groups} />;
}
