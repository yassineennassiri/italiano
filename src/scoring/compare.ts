/**
 * Typed-answer comparison (SPEC §5.1). Pure: no React, no database.
 */
import type { Gap } from "@/content/schema";

export type GapVerdict = "correct" | "wrong" | "accent_only";

/** What a typed answer is compared against. */
export type AnswerKey = Pick<Gap, "answer" | "accept" | "case_sensitive">;

export function compareTyped(given: string, gap: AnswerKey): GapVerdict {
  const fold = (text: string) => {
    const normal = normalize(text);
    return gap.case_sensitive === false ? normal.toLocaleLowerCase("it") : normal;
  };
  const typed = fold(given);
  const expected = [gap.answer, ...(gap.accept ?? [])].map(fold);
  if (expected.includes(typed)) return "correct";
  const bare = stripAccents(typed);
  if (expected.some((answer) => stripAccents(answer) === bare)) return "accent_only";
  return "wrong";
}

/** NFC first, so a decomposed è (e + U+0300) equals a composed one. */
function normalize(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/g, " ").replace(/’/g, "'");
}

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

export type GapsResult = {
  /** True only when every gap is correct. */
  correct: boolean;
  /** Gap id → verdict. */
  gaps: Record<string, GapVerdict>;
};

/** Checks every gap of an item; a missing answer counts as wrong. */
export function checkGaps(
  gaps: readonly (AnswerKey & Pick<Gap, "id">)[],
  answers: Readonly<Record<string, string>>,
): GapsResult {
  const verdicts: Record<string, GapVerdict> = {};
  for (const gap of gaps) verdicts[gap.id] = compareTyped(answers[gap.id] ?? "", gap);
  return { correct: Object.values(verdicts).every((verdict) => verdict === "correct"), gaps: verdicts };
}
