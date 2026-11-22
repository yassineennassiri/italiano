/**
 * *I miei errori più frequenti* (SPEC §10.5): the error tags of the learner's
 * recent unresolved error_log rows, counted. The store picks the rows
 * (unresolved, last 30 days); this counts them. Pure.
 */
import type { ErrorTagEntry } from "@/content/schema";

/** The panel lists this many tags. */
export const TOP_TAGS = 5;

/** How far back the panel counts. */
export const RECENT_DAYS = 30;

/** A tag as the panel lists it: how many rows carry it, and its English explanation. */
export type TopTag = { id: string; count: number; explanation: string };

/**
 * The 5 tags carried by the most rows, most first, ties by tag id. A row
 * counts once for each tag it carries; tags `error-tags.json` no longer has are left out.
 */
export function topErrorTags(
  rows: readonly { errorTags: readonly string[] }[],
  tags: readonly (Pick<ErrorTagEntry, "explanation_en"> & { id: string })[],
): TopTag[] {
  const explanations = new Map(tags.map((tag) => [tag.id, tag.explanation_en]));
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of new Set(row.errorTags)) {
      if (explanations.has(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts]
    .sort(([a, countA], [b, countB]) => countB - countA || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, TOP_TAGS)
    .map(([id, count]) => ({ id, count, explanation: explanations.get(id)! }));
}
