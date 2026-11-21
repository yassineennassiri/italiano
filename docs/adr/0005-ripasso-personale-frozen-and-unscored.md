# Ripasso personale is chosen once per lesson visit and never scored

The Ripasso personale step (up to 3 due item cards from other lessons, inserted before *Parla!*) is **chosen the first time I open the lesson and stored** in `lesson_progress.review_items`, rather than recomputed on every page load. Cards fall due by the hour, so recomputing would change the step count ("7 / 11") mid-lesson and differ between my two computers. Azzera and finishing the lesson clear the choice.

Its exercises count in the footer's *X di Y* but are **not scorable**: no points, not in the lesson %, the Results S/M or *Correggi i miei errori*. Which cards appear depends on my history, not on the lesson, so scoring them would make the same lesson's % incomparable between plays and would mix review into the scoring rule of ADR-0002. Each answer grades its review card instead (ADR-0004).

## Consequences

- Changing either rule later would shift stored step counts or `best_percent` values, which is why it is recorded here.
- The step references items from other lessons; their content comes from those lessons' files, and an item whose content has changed shows its current version.
