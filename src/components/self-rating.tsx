import type { ExerciseEntry } from "@/items/entry";
import { type Rating, ratingViews } from "@/items/self-rating";
import { ui } from "@/ui-it";
import { OptionButton } from "./option-button";
import { PromptBubble } from "./prompt-bubble";

const RATINGS: readonly Rating[] = ["good", "not_great"];

/**
 * *Com'è andata?* on the left and **Bene** / **Non tanto bene** stacked on the
 * right (SPEC §5.2.11, `[10]`). Rating locks the choice: the chosen button
 * stays highlighted, the other dims.
 */
export function SelfRating({ entry, onRate }: { entry: Pick<ExerciseEntry, "state">; onRate: (rating: Rating) => void }) {
  const views = ratingViews(entry);
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-start">
      <div>
        <PromptBubble>{ui.lesson.rateQuestion}</PromptBubble>
      </div>
      <ul className="space-y-2">
        {RATINGS.map((rating) => (
          <li key={rating}>
            <OptionButton {...views[rating]} pressed={views[rating].look === "selected"} onClick={() => onRate(rating)}>
              {ui.lesson.rating[rating]}
            </OptionButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
