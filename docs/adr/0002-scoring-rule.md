# Scoring: first Check only, self-ratings never score

DW's lesson % can't be reproduced from its screenshots: `[41]` shows 79% for a lesson with 37 items, and no whole number of points out of 37 (or out of 31, leaving out the self-ratings) gives 79%. So we define our own rule rather than claim parity.

- The footer counts **exercises**. Each exchange of a speaking item is its own exercise, as on DW `[10]`.
- A scorable item earns 1 point only if its **first** Check is fully correct. Solving, or retrying correctly after a wrong Check, earns 0, though the retry is stored as an attempt.
- **Self-rated exercises** (speaking exchanges, Parla!) count as completed but never earn points and are left out of the % denominator. Otherwise *Bene* would be a free point and the % would stop meaning anything.
- Lesson % = round-half-up(100 × points ÷ scorable items). Unattempted items count as 0. An accent-only mistake scores 0 like any other.
- Level % = completed lessons ÷ the level's planned lessons, including ones not yet written.

The rule lives in one pure function with Vitest cases. Changing it later would silently shift every stored `best_percent`, which is why it's recorded here.
