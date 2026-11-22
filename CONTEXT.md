# La strada di Adam

A personal Italian course for one learner. It copies the structure and interaction design of DW's *Nicos Weg*, with original content: Adam, an engineer, moves to Genoa to work at Energetica Ligure.

## Language

### Course structure

**Level**:
One of the three course stages: Ripasso A2, B1, B2.
_Avoid_: Course, grade

**Unit**:
A themed chapter inside a level with one grammar focus, e.g. "A2.1 Arrivo a Genova". The course plan fixes how many lessons each unit is planned to have.
_Avoid_: Chapter, module

**Lesson**:
One 20–25 minute sitting inside a unit: intro, exercise steps, results, review sequence, finish.
_Avoid_: Episode, class

**Draft lesson**:
A lesson whose content has been written but not yet reviewed by the learner. It is playable like any other lesson.

**Scene**:
The illustrated story dialogue at the heart of a lesson: a poster, a sequence of panels and spoken lines. It takes the place of DW's video.
_Avoid_: Video, episode

**Script**:
The transcript of a scene's lines, with speakers and English translations. Shown in the UI as *Copione*.
_Avoid_: Transcript, subtitles

**Clip**:
A span of a scene's lines, from one line to a later one (or a single line), that an exercise plays on its own: an *audio_choice* 🔊, the clip player at the top of a step, or an *audio_gap* mini player.
_Avoid_: Excerpt, snippet

**Step**:
One numbered exercise page inside a lesson ("3 / 9"), holding one or more items.
_Avoid_: Page, exercise, screen

**Vocab link**:
A word in a prompt, script or reading text that is linked to an entry in the same lesson's vocabulary list and shows its meaning on hover or tap.
_Avoid_: Tooltip, gloss

**Review sequence**:
The pages after the results: grammar pages, then vocabulary, then culture if the lesson has it, navigated as one line.
_Avoid_: Appendix, overview

### Exercises and scoring

**Item**:
One unit of exercise content inside a step with its own interaction: a gap fill, a choice, a word order, a speaking block or a Parla! task.
_Avoid_: Question, task, widget

**Exchange**:
One turn inside a speaking item: the other character's line, the learner's reply, and a self-rating.
_Avoid_: Turn, line

**Exercise**:
The unit the "X of Y completed" counter counts. A checkable item is one exercise; each exchange of a speaking item is one exercise; a Parla! task is one exercise.
_Avoid_: Using "exercise" for a step or for a whole speaking item

**Gap**:
One blank inside an item's text that the learner fills by typing, choosing or placing a tile.
_Avoid_: Blank, slot, field

**Check**:
The learner's request to have an item's answer evaluated. Shown as *Controlla*. Only the first Check can earn a point.
_Avoid_: Submit, validate

**Solve**:
The learner's request to reveal the correct answer of an item. Shown as *Soluzione*. A solved item earns no point.
_Avoid_: Reveal, show answer

**Self-rating**:
The learner's own judgement of a spoken exercise: *Bene* or *Non tanto bene*.
_Avoid_: Grade, score

**Scorable item**:
An item that is evaluated by the app rather than self-rated. Only scorable items earn points and count toward the lesson %.

**Point**:
What a scorable item earns when its first Check is fully correct. At most one per item, however many gaps it has.
_Avoid_: Score (for a single item)

**Completed**:
An exercise is completed once it has been checked, solved or self-rated, right or wrong. A step is completed when all its exercises are. A lesson is completed when the learner reaches its finish screen.
_Avoid_: Done, passed, correct

**Lesson %**:
Points earned as a share of the lesson's scorable items.
_Avoid_: Grade, score

**Level %**:
Completed lessons as a share of all lessons planned for the level, including lessons not written yet.

### Speaking

**Parla!**:
The open speaking task that is always the last step of a lesson, tied to the scene and self-rated.
_Avoid_: Speaking test, free talk

### Learning history

**Error tag**:
A named category of mistake from the learner's weak points, e.g. `article.elision` or `register.lei`, with an English explanation.
_Avoid_: Error type, label, category

**Error log**:
The permanent record of the learner's mistakes: wrong first Checks, *Non tanto bene* ratings, hesitation notes and pasted corrections, each with error tags. Resetting a lesson never clears it.
_Avoid_: Mistake history, wrong answers

**Correction**:
A mistake the learner made outside the app (e.g. with a tutor), entered by hand as what they said and the corrected version. It becomes an error log entry and an error card.
_Avoid_: Fix, manual entry

**Resolved**:
An error log entry whose review card has been answered well three times in a row. It stays in the log but no longer counts toward the learner's top error tags.
_Avoid_: Fixed, closed

**Review card**:
A spaced-repetition card scheduled from the learner's history. There are three kinds: vocab card, item card, error card.
_Avoid_: Flashcard (except in the vocab trainer UI)

**Vocab card**:
A review card for one vocabulary entry: English meaning on the front, the Italian term with its article on the back. The learner grades it themselves.

**Item card**:
A review card that re-asks one exercise the learner got wrong, solved without trying, or rated *Non tanto bene*.

**Error card**:
A review card built from a correction: it shows the wrong version and asks for the corrected one.

**Grade**:
How well a review went: *again*, *hard*, *good* or *easy*. The app sets it from the answer wherever it can check; only vocab cards are graded by the learner.
_Avoid_: Score, rating (rating is for self-rating)

**Review hub**:
The page for spaced review outside lessons: due cards, the learner's top error tags, and adding corrections. Shown as *Ripasso*.
_Avoid_: Dashboard, trainer

**Review session**:
One run through due review cards in the review hub, at most twenty at a time.
_Avoid_: Quiz, round

**Tag drill**:
A short run of exercises sharing one error tag, taken from completed lessons and started from the review hub.
_Avoid_: Practice mode

**Ripasso personale**:
An extra step inserted before Parla! with up to three due item cards from other lessons, preferring those whose error tags match the lesson. It is chosen once per lesson visit and never scores.
_Avoid_: Bonus step, review step

**Reset**:
Clearing a lesson's (or level's) exercise state and score so it can be played again. Shown as *Azzera*. The error log and review cards survive it.
_Avoid_: Clear, restart

### Notes

**Feedback note**:
A note the learner writes about content to fix, attached to a level or to a page of a lesson. It is marked done once fixed.
_Avoid_: Comment, bug report
