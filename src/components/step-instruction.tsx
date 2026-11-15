"use client";

import { useState } from "react";
import { ui } from "@/ui-it";

/** The step instruction, with an EN toggle only when the content has an English version (SPEC §4.2). */
export function StepInstruction({ instruction, instructionEn }: { instruction: string; instructionEn?: string }) {
  const [showEnglish, setShowEnglish] = useState(false);
  return (
    <div className="mt-2">
      <p className="flex items-start justify-between gap-4">
        <span>{instruction}</span>
        {instructionEn && (
          <button
            type="button"
            aria-pressed={showEnglish}
            aria-label={ui.lesson.showEnglish}
            onClick={() => setShowEnglish((value) => !value)}
            className={`shrink-0 rounded border px-2 py-0.5 text-xs font-bold ${
              showEnglish ? "border-brand bg-brand text-white" : "border-brand text-brand hover:bg-tint"
            }`}
          >
            {ui.lesson.english}
          </button>
        )}
      </p>
      {instructionEn && showEnglish && (
        <p lang="en" className="mt-1 text-muted italic">
          {instructionEn}
        </p>
      )}
    </div>
  );
}
