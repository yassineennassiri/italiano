# Spaced review: SM-2 with a review log, graded by the app, apart from lesson progress

Review cards are scheduled with classic **SM-2**, a small pure function, rather than FSRS. With one learner and a few hundred cards, SM-2's fixed rules are easy to test and reason about. To keep a later switch cheap, every review is also written to an append-only **`review_log`** (grade, interval and ease before and after), which is the history FSRS needs to fit its parameters.

Reviews are **graded by the app** wherever it can check the answer: a correct first Check is *good*, an accent-only miss *hard*, a wrong answer or Soluzione *again*; speaking reviews map *Bene* / *Non tanto bene* to *good* / *again*. Only vocab flip cards, which the app can't check, show Anki's four buttons. A review **never changes the lesson's item state or its %**: a lesson's results stay as I played them, and reviewing is a separate record.

## Considered Options

- **FSRS (`ts-fsrs`) from the start**: better scheduling, but more state per card and opaque to debug. Deferred; the review log makes it a migration rather than a restart.
- **Four grade buttons on every card**: more signal, but an extra click after every Check, and self-grading an answer the app already marked invites cheating myself.
- **Reviews update the lesson's item state**: one source of truth, but a review would rewrite past lesson results and their `best_percent`.

## Consequences

- Changing the scheduler later reshuffles every due date, so it should happen once, deliberately, using the review log.
- A review writes `review_log` plus an `exercise_attempt` row with action `review`, never `item_state`. A vocab card has no exercise behind it, so its grade writes `review_log` only (issue #45).
