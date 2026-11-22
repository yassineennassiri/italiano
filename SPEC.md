# La strada di Adam: product and UX spec

A personal Italian course web app that copies the **structure and flow** of DW's *Nicos Weg* German course, filled with original Italian content.

> **How to use this document.** This spec has been through two grilling sessions; section 16 logs the M1 decisions and section 17 the M2 decisions. Read it together with the course plan (`docs/course-plan.md`), the glossary (`CONTEXT.md`) and the ADRs (`docs/adr/`). Section 14 describes the milestones; each one is tracked as GitHub issues. Screenshots of the original are in `./screenshots/` and are referenced by number, e.g. `[04]` = `screenshots/04-a1-lesson-introduction.png` (full index in Appendix A).

| | |
|---|---|
| Owner and only user | Yassine (B1 Italian, works in energy R&D in Genoa) |
| Working title | *La strada di Adam* (placeholder, rename freely) |
| Reference product | DW Learn German, *Nicos Weg* (A1–B1) |
| Build tool | Claude Code with Matt Pocock skills; GitHub issues for tracking |
| Runtime | Local only (`npm run dev`) on two computers; no deployment |
| Progress storage | Neon Postgres, so progress syncs between the two computers |
| Content storage | Versioned JSON files plus media in the repo |

---

## 1. Goals and non-goals

### Goals
1. **Same learning experience as Nicos Weg.** Use the same hierarchy (level > unit > lesson), the same lesson flow (intro > numbered exercise steps > results > grammar > vocabulary > culture > finish > next lesson), the same exercise types and the same Check / Solve / feedback / scoring behaviour. When something here is unclear, do what Nicos Weg does.
2. **Personal content.** The story follows Adam, an engineer who moves to Genoa to work at *Energetica Ligure*. Levels are Ripasso A2, then B1, then B2. The UI, step titles and instructions are in Italian; grammar and culture are explained in English (6.3). Nouns always appear with their article.
3. **Speaking first.** Every lesson ends with a *Parla!* speaking task. Self-rating (*Bene* / *Non tanto bene*) is the baseline.
4. **Learn from my mistakes.** Wrong answers and self-reported speaking errors go into an error log. The log feeds spaced review.
5. **Synced progress.** I can start a lesson on one computer and continue on the other.
6. **Content as data.** Adding a lesson means adding a JSON file plus media, with no code changes. Content is validated against a schema in dev and in CI.

### Non-goals (v1)
- No copying of DW's text, video, images, audio, logos, colour scheme or name. Copy the structure and interaction design only.
- No public deployment, multi-user accounts, sign-up, social features or payments.
- No real filmed video. Each "episode" is an illustrated scene with dialogue audio.
- No native mobile app. It is a responsive web app; a desktop browser is the main target.
- Placement test, final test per level, vocab trainer UI and automatic speech recognition are **later** milestones (section 15). The data model leaves room for them.
- No in-app content authoring UI. Content is written as files, by me or by an AI assistant.

---

## 2. Glossary

The domain glossary lives in `CONTEXT.md` (Level, Unit, Lesson, Step, Item, Exchange, Exercise, Scorable item, Scene, Self-rating, …). This spec uses those terms as defined there.

---

## 3. Information architecture

```
Home (levels)
└── Level overview          /:level                       e.g. /a2
    └── Lesson              /:level/:lesson               e.g. /a2/benvenuto-a-genova
        ├── Information (intro)          /info
        ├── Exercises  step 1..N         /esercizi/:n
        ├── Results                      /risultati
        ├── Grammar  page 1..G           /grammatica/:n
        ├── Vocabulary                   /vocabolario
        ├── Culture (optional)           /cultura
        ├── Script                       /copione
        └── Finish                       /fine
Review hub (my errors, due vocab)         /ripasso
Settings                                  /impostazioni
Feedback notes                            /feedback
```

URLs use stable slugs from the content files. Deep links and the browser Back button work. The last visited step is restored when I reopen a lesson.

### 3.1 Global chrome
All chrome text is Italian (6.3); the labels below are the real UI strings.

- **Top bar**: logo (an SVG of the Lanterna, Genoa's lighthouse, plus wordmark) on the left, app title in the centre, hamburger on the right (Home, levels; from M2 also Ripasso, Impostazioni and Feedback). Ref `[03]`.
- **Lesson bar**: a full-width coloured bar under the top bar on every lesson page. It shows the lesson title in the centre and a chevron on the right that opens the **lesson menu**. Ref `[04]`, `[23]`.
- The top bar and lesson bar are **sticky**: they stay pinned while the page scrolls (`[06]`, `[34]`).
- **Lesson menu** (drop-down panel on the right, `[23]`): Informazioni · Esercizi · Grammatica · Vocabolario · Cultura · Copione · Altri strumenti (Review hub; vocab trainer later) · Segnala un problema (M2, 10.6) · Azzera gli esercizi · Panoramica del corso. Hide entries the lesson doesn't have (e.g. Cultura).
- **Breadcrumb**: `Level / Course / Lesson / Step title` above the content, **only on the intro and exercise step pages** (`[04]`, `[07]`). Results, grammar, vocabulary, culture, script and finish pages have only the lesson bar.
- **Footer**: minimal (app name, content version (a short hash of the content JSON files, so both computers can tell they run the same content), sync status: *Salvato* / *In attesa* / *Offline: non salvato*, which becomes *Offline: salvato su questo computer* once the IndexedDB queue holds the write, §8). DW's footer is not copied.

### 3.2 Home
A simple page listing the three levels as large cards (level badge, title, short description, % completed), plus a *Continua da dove eri* button that goes to the last lesson/step. It's loosely modelled on `[02]`. Until a level has content, its card is disabled and labelled *In arrivo* (in M1, B1 and B2). The placement test card is a later feature.

### 3.3 Level overview page (`[01]`, `[03]`)
- **Hero banner**: a full-width original illustration with a circular level badge top-left ("A2", "B1", "B2") and the course logo badge on the right.
- Below the banner on the right: an **Azzera** button (resets all progress for the level after a confirmation dialog) and the level's overall status circle.
- **Unit groups** in a 3-column grid (1 column on narrow screens). Each column header is the unit number + title ("1 Arrivo a Genova"). The first group can be an intro unit ("Benvenuto!"). Every unit from the course plan is listed; a unit with no lesson files yet shows a single disabled *In arrivo* card.
- **Lesson cards** under each header:
  - Italian lesson title (bold, link colour), e.g. *Benvenuto a Genova!*
  - Line 1: topic in Italian, e.g. "Arrivare a Genova e salutare"
  - Line 2 (optional): grammar label, e.g. "Articoli: il, lo, l', la"
  - A *Bozza* badge when the lesson's `status` is `draft` (draft lessons are fully playable; that's how they get reviewed).
  - Top-right **status circle**: empty = not started, half-filled = in progress, filled with a tick = completed. A tooltip shows the state plus the best % ("Completata · 87%").
  - Cards alternate between light background tints, as on DW.
- Below the grid, as on DW: **Altre lezioni** (link to the Review hub), **Test finale** (disabled, *In arrivo*) and **Feedback** (a textarea saved to the DB for my own notes about the content, `scope = level`; M2, 10.6).

---

## 4. Lesson flow (end to end)

```
Intro ─Inizia→ Step 1 … Step N ─Avanti on last step→ Results ─Continua→ Grammar 1..G → Vocabulary → Culture? → Finish ─Avanti→ next lesson's Intro
```

The grammar pages, vocabulary and culture form **one linear review sequence**. Each page has a header strip with ‹ › arrows that move through that whole sequence, hidden at either end: the first grammar page has only ›, culture (or vocabulary, when there is no culture) has only ‹ (`[19]`–`[22]`, `[42]`–`[44]`).

### 4.1 Intro / Information page (`[04]`, `[25]`)
- **Scene player** in poster state: a large 16:9 illustration with a round play button bottom-left and the duration ("01:08").
- **Heading**: the topic in Italian ("Arrivare a Genova e salutare").
- **Summary**: 2–4 sentences in Italian about what happens in the story.
- **Learning objectives**: a bulleted *In questa lezione impari a…* list in Italian (communicative goal, grammar point, vocab field).
- **Inizia** button (primary) → Step 1. Playing the scene here is optional, because Step 1 embeds it again.

### 4.2 Exercise step pages (`[05]`–`[17]`, `[26]`–`[40]`)
Layout from top to bottom:
1. Optional **media** at the top: the scene player or a large image (`[05]`, `[14]`, `[15]`).
2. Step counter **"N / M"**, small and centred (`[10]`).
3. **Step title** (H2, Italian), e.g. "il, lo, l' o la?".
4. **Instruction** (1–2 sentences, Italian). When the content provides `instruction_en`, a small **EN** toggle next to it reveals the English version.
5. **Copione ⌄** toggle, collapsed by default. Expanding it shows the transcript of the audio/scene used by this step, with speaker labels in caps (`[06]`, `[32]`, `[37]`). It collapses again with **Copione ⌃**.
6. Optional **reading text** (a brochure, a to-do list, an email) shown inline, often on a tinted panel (`[31]`, `[33]`).
7. One or more **items**. Each has its own prompt bubble (a speech bubble with an accent border and a tail), its interaction area, optional notes (4.3), then **Soluzione** (secondary) and **Controlla** (accent) buttons, centred.
8. **Footer band** (tinted, full width): the counter text from 6.2 and an **Avanti** button, with the "N / M" counter repeated under it (`[07]`, `[17]`).

Rules:
- **Avanti is always enabled.** Skipping is allowed, and unattempted exercises simply stay "not completed".
- On the last step, Avanti goes to **Results**.
- Item state (typed answers, checked/solved status, points) persists immediately (sections 8 and 10), so reloading or switching computers restores it.

### 4.3 Notes inside steps
Small rows with a round icon, placed under an item, or inside a speaking item between one exchange and its rating (`[10]`, `[12]`). Labels are Italian; the note text is English, because notes explain grammar (6.3).
- **Info:** a grammar or usage remark (`[09]`, `[11]`).
- **Consiglio:** a strategy hint.
- **Parole nuove:** a word introduced here, with a short English gloss (`[15]`, `[37]`).
- **Attenzione!:** our addition for my recurring error patterns (e.g. "*l'* before a vowel, never *il*"). It links to the error tag's explanation.

**Vocab links (M2):** words highlighted with a dotted underline, as on DW. They are allowed in prompts, scene and script lines, step `reading` texts, and gap-item `text` outside the gaps; never in options, tiles or gap answers, where they would give the answer away. The popover shows the term with its article and plural, the gender dot, the English meaning and a 🔊 button. It opens on hover (desktop), on click or tap, and on Enter when the link has keyboard focus; Esc closes it. A link may only point at an entry in **the same lesson's** vocabulary list.

### 4.4 Results screen (`[18]`, `[41]`)
- Heading *Risultati della lezione*.
- An encouraging line chosen by score band (≥80% *Ottimo lavoro!*, 50–79% *Buon lavoro, continua così!*, <50% *Riprova gli esercizi, ce la puoi fare.*).
- A large slate panel with the **percentage** (big) and *Risultati della lezione: S/M* (6.1).
- The line *Nelle prossime pagine trovi un riepilogo di: …*, listing only the pages this lesson has (grammatica, vocabolario, cultura e società), as in `[41]`.
- Buttons. These replace DW's guest buttons ("Log in and correct mistakes" / "Continue (without saving)" / "Log in and save"), since we're always saving:
  - **Correggi i miei errori**: jumps to the first step with a wrong or unattempted scorable item, and resets only those items. Speaking exchanges are never reset here (their errors already went to the error log). A reset keeps `first_check_correct`, so a fixed item still scores 0.
  - **Continua** (accent): goes to Grammar 1.

### 4.5 Grammar pages (`[19]`, `[20]`, `[42]`, `[43]`)
- A header strip with *Grammatica* and the ‹ › arrows of the review sequence (section 4). Usually 2 grammar pages per lesson.
- A **vertical illustrated article** in a narrow centred column: an H2 title ("Articoli determinativi: il, lo, l', la"), an illustration with an example sentence from the scene (target form in **bold**, sentence in italics), a compact **form row/table** (e.g. *Singular · masculine · before a vowel · **l'**ombrello*), the rule in English, and optional **rule images**. Rule images are `rule` blocks (9.1) rendered as SVG components, not bitmaps: rows of styled text segments joined by arrows, covering DW's coloured words, down/diagonal arrows and swap arcs (`[19]`, `[42]`, `[43]`). M1 needs only rows plus a down arrow.
- An optional **terms panel** defining metalanguage ("gender", "elision"): a full-width block at the bottom of the page, ruled top and bottom (`[20]`, `[43]`).
- **Avanti** button at the bottom (accent). On the last grammar page it goes to Vocabulary.

### 4.6 Vocabulary page (`[21]`, `[44]`)
- A header strip with *Vocabolario* and the ‹ › arrows of the review sequence. There is no pagination; the arrows only move between review pages.
- A **striped list**: left = speaker icon + Italian term in link colour, middle = optional thumbnail image for concrete nouns (`[44]`), right = English meaning.
- **Nouns always with article and plural**: *la valigia, le valigie*; *l'ombrello, gli ombrelli*. A small m/f gender dot is our addition, for my article errors.
- A small grey **forms line** under the term. It is free text: verb forms (*mi perdo, si perde, mi sono perso/a*), irregular adjective forms, or notes such as *solo singolare* or *dal genovese* (`[21]`, `[44]`).
- Entries include phrases and whole sentences, not just single words (`[21]`).
- Sorted alphabetically, ignoring the article. An entry's optional `sort_key` overrides this, e.g. *in ritardo* sorts under *ritardo*.
- Bottom button: **Avanti** (to Culture), or **Finisci la lezione!** when the lesson has no culture page (`[44]`).

### 4.7 Culture page (`[22]`, `[23]`)
A header strip *Cultura e società* with the ‹ arrow, an H2 title, a large image, and 2–5 paragraphs of English prose with Italian key terms in bold. Bottom button: **Finisci la lezione!**

### 4.8 Script page (`[24]`, `[45]`)
Reached from the lesson menu (*Copione*), outside the linear flow. It shows the scene player at the top, then *Copione* (H2), then the full transcript with **SPEAKER:** above each line. **Our additions:** clicking a line toggles its English translation underneath, and a ▶ icon on each line plays that line's audio.

### 4.9 Finish screen (`[46]`, `[47]`)
Heading *Risultati della lezione*, the same slate % panel, *Avanti con la prossima lezione!*, and a wide accent **Avanti** button to the next lesson's intro. On the last lesson of a level it goes to the level overview with a *Livello completato* banner. Reaching this screen marks the lesson **completed**.

### 4.10 Reset
- **Azzera gli esercizi** (lesson menu): clears this lesson's item states and score after a confirmation dialog. The lesson goes back to not started. The error log and review cards are **kept**, because they are learning history.
- **Azzera** (level overview): the same for every lesson in the level.

---

## 5. Exercise type catalogue

### 5.1 Common item behaviour (applies to every checkable type)

| State | UI and scoring |
|---|---|
| **Untouched** | Inputs active; Soluzione and Controlla enabled. |
| **Checked, all correct** | Every input turns **green**. Inputs, Solve and Check are disabled (greyed out, see the first two items in `[17]`). Item is *completed*, **+1 point**. |
| **Checked, some wrong** | Correct parts turn **green and lock**. Wrong parts turn **red** and stay editable. Soluzione and Controlla stay enabled (`[07]`, the third item in `[17]`, `[34]`). Item is *completed* (attempted), **0 points**. Editing a red input clears its red state. |
| **Re-check after wrong** | Evaluated again. If it's now all correct, everything turns green and locks, but the item **still scores 0**, because points come only from the first Check. The retry is still stored as an attempt. |
| **Solved** | Correct answers are filled in, everything is disabled. Item is *completed*, **0 points**. |
| **Self-rated** | Clicking **Bene** or **Non tanto bene** marks the exchange *completed* and locks the choice (the chosen button is highlighted, the other is dimmed). Self-ratings never score (6.1). |

Other common rules:
- **One point per item**, no matter how many gaps it has. DW counts points per exercise: `[17]` shows "3 out of 3 exercises completed. 2 points scored."
- **Speaking items are counted per exchange.** Each exchange of a `speak_rate` item, and the single rating of a `parla` item, is its own exercise in the footer counter, as on DW (`[10]`: two exchanges = "0 out of 2 exercises").
- **Typed answers**: trim and collapse whitespace; straight `'` and curly `’` apostrophes are equal. Accents matter (*è* ≠ *e*). If the **only** difference is an accent, mark the answer red with the hint *Controlla l'accento*. It still scores 0, like any wrong answer; the leniency is only the hint and the missing review card (10.5). Each gap can list `accept` alternatives. Matching is case-sensitive by default, configurable per gap.
- Every wrong first Check writes **error_log** rows (10.4) with the item's `error_tags`.
- The footer counter updates live.
- Keyboard: Enter in a text gap = Check that item; Tab moves between inputs; option buttons are focusable.
- **Italian character helper**: a keyboard icon next to typed gaps (one per gap in the full-width layout) opens a palette (à è é ì ò ù À È) that inserts at the cursor. This replaces DW's special-character icon in `[09]` and `[31]`.
- Feedback must not rely on colour alone: add ✓ / ✗ icons.

### 5.2 Types
The `type` value is the JSON discriminator.

#### 1. `dropdown`: inline select gaps (`[05]`, `[07]`, `[08]`, `[11]`)
- A sentence or dialogue with inline selects showing "…" as the placeholder. Options are per gap, or shared across gaps in a fixed order ("choose the missing words in the right order", `[11]`).
- Optional image on the left, with the text panel on the right (one item per image, `[07]`).
- Each select turns green or red.

#### 2. `text_gap`: typed gap fill (`[09]`, `[30]`)
- Default layout: a dialogue/text panel with inline text inputs sized to the answer, a character-helper icon, and an optional image + prompt bubble on the left.
- **Full-width** layout (`layout: "full"`, `[30]`): a full-width prompt bubble above a document panel with the gaps; any image sits at step level.
- This is the workhorse for articles, pronouns, verb endings and conjugation drills.

#### 3. `word_order`: tile sentence builder (`[16]`, `[17]`, `[29]`)
- Left: an optional prompt bubble (the other speaker's line, or a sentence start like "Nicos Eltern sind wütend, …"). Right: an empty dotted **answer box** with shuffled **tiles** (light pill buttons) below. Tiles can be words, chunks or punctuation.
- Clicking a tile moves it to the end of the answer, where it turns dark. Clicking a placed tile sends it back. There is no drag-reorder (dropped in the M2 grilling: click-to-place works and is keyboard-friendly).
- **Lines** variant (`layout: "lines"`, M2): the tiles are whole script lines stacked vertically, for the course plan's "put the lines in order".
- Check compares the sequence with the solution (alternatives via `accept`). The answer box border turns **green or red** (`[17]`).
- The shuffle is deterministic (seeded by item id), so the layout is stable across reloads. Never show tiles already in the solved order.

#### 4. `single_choice`: one correct option (`[14]`, `[34]`, `[37]`)
- A prompt bubble on the left (optionally with 🔊), and 2–4 stacked full-width option buttons on the right.
- **Clicking an option checks it immediately**; DW has no Check button here (`[34]`, `[37]`). If correct, the option turns green with a bubble tail, and the other options grey out and disable. If wrong, the option turns red and the others stay active for a retry (0 points from then on).
- Solve is optional per item (`solvable: true`).

#### 5. `multi_select`: N correct options (`[15]`, `[26]`, `[27]`, `[35]`)
- Same layout as single_choice, but the instruction or prompt states how many are right (*Ci sono due risposte giuste*). Options toggle on and off; evaluation happens on **Controlla**. Correct picks turn green and wrong picks red. Soluzione marks all correct options green.
- DW's "word sets" (`[35]`) are just this type with short options; there is no separate chip-grid layout.

#### 6. `image_choice`: pick the description for an image (`[28]`)
- A prompt bubble ("Che cosa succede?") above an image on the left, and 2 option buttons on the right. It behaves like `single_choice`; it's a separate type only for its layout.
- Supports an optional intro paragraph above all items (in `[28]` it introduces the new words). It is the step's `reading` field, so the schema needs no new field.

#### 7. `reading`: reading comprehension (`[33]`, `[34]`)
- The step's `reading` text is rendered as a document (heading, subheads, paragraphs, vocab links). Brochures, emails, contract clauses and meeting minutes suit the story.
- It's followed by N `single_choice` items, one per question.

#### 8. `audio_choice`: listen, then choose (`[14]`, `[36]`, `[37]`, `[39]`)
- The prompt bubble shows a transcript line with "…" where the missing line goes, plus a 🔊 button when the item provides audio. Options are on the right, and it behaves like `single_choice`.
- What 🔊 plays is an optional `clip: { from_line, to_line }` of scene lines, as in `audio_gap`. Before MP3s exist, `speechSynthesis` speaks those lines; afterwards the MP3 timeline plays the same span. An item with neither a clip nor `prompt_audio` shows no 🔊.
- Alternatively the step carries a **clip player** as its top media (`media.kind: "clip"`, `[39]`) with its own duration, and the item prompts are plain text.
- **Reason** variant (`[36]`, `[37]`): the prompt is a sentence start ("Adam è contento, …") and the options are clause completions ("perché …").

#### 9. `word_bank`: fill gaps from given words (`[38]`)
- A text panel with empty gaps, and a **bank of tiles** right-aligned below it. The instruction says "in the right order".
- Clicking a tile fills the **first empty gap**. Clicking a filled gap returns its word to the bank. Banks can contain duplicates (e.g. the same verb twice) and distractors.
- Check and feedback work per gap, as in `text_gap`.

#### 10. `audio_gap`: listen and fill (`[31]`)
- Left: a prompt bubble and a **mini scene player** that plays only a clip of the scene (from/to line ids). Right: a document panel (a to-do list, a form, a note) with typed gaps that behave like `text_gap`.
- Optional Info note.

#### 11. `speak_rate`: audio self-assessment (`[10]`, `[12]`, `[13]`, `[40]`)
- Rows of **exchanges**. Left: an accent-bordered bubble with the other character's line and 🔊. Right: a tinted bubble with my expected reply, which can contain placeholders ("Mi chiamo … E Lei?") for my own details. An optional Italian `hint` sits under it.
- After each exchange, a *Com'è andata?* bubble sits on the left, with two stacked buttons **Bene** / **Non tanto bene** on the right (`[10]`). **Each exchange is its own exercise** with its own id and state.
- A note can sit between an exchange and its rating (`exchanges[].notes`, `[10]`, `[12]`).
- Variants: **dialogue** (`[10]`), **read_along** (`[12]`: both sides given, I read mine aloud), **personal** (`[13]`, `[40]`: a question on the left and a hint/example on the right; I answer freely).
- **Optional recording (M3):** a 🎙 button records my answer with MediaRecorder for playback next to the model audio. Recordings are stored only in the browser (IndexedDB), never uploaded.
- **Non tanto bene** writes an error_log row (source `speak_rate`, the item's tags) and, from M2, creates or resets an item review card for that exchange (10.5).

#### 12. `parla`: closing speaking task (our addition, always the last step)
- A bigger open task tied to the scene, written in Italian with an Italian example answer. Example: *Un collega ti chiama: raccontagli com'è andato l'arrivo.*
- It shows a checklist of target structures in Italian (*Usa l' davanti a vocale almeno due volte*), an optional recording button (M3), and the **Bene / Non tanto bene** self-rating. The rating is one exercise.
- An optional free-text box, *Su cosa hai esitato?*. Its content goes to the error log (`source = parla_note`).
- **Future:** speech-to-text plus AI correction (section 15).

#### 13. Scene check: the Step 1 pattern (`[05]`, `[26]`)
This is a step pattern, not a widget: the scene player as top media, followed by `dropdown`, `multi_select` or `single_choice` items about the story. Step 1 of every lesson follows it. The scene never locks the questions.
- Its **first item is the gist question** from the course plan, worded *Prima di guardare: …*.
- The course plan's *Hai capito?* comprehension types map onto existing types: true/false is a `single_choice` with *Vero / Falso*; "who said what" is a `dropdown` whose options are speaker names; "put the lines in order" is `word_order` with `layout: "lines"` (M2).

#### Typical lesson recipe (mirrors DW's sequences)
1 scene check → 2 typed/dropdown grammar discovery from the dialogue (with Info) → 3 dialogue `speak_rate` → 4 grammar `dropdown`/`text_gap` → 5 `audio_choice` or `audio_gap` → 6 `reading` or `image_choice` → 7 `multi_select` / `word_bank` → 8 `word_order` → 9 personal `speak_rate` → last: `parla`. That's 8–11 steps in total.

---

## 6. Scoring and progress model

### 6.1 Definitions
DW's exact % rule can't be reproduced from the screenshots (no integer number of points over `[41]`'s 37 items gives 79%), so these rules are ours (ADR-0002).
- **Exercise**: the unit the footer counts. A checkable item is one exercise; each `speak_rate` exchange is one exercise; a `parla` item is one exercise.
- **Exercise completed**: checked at least once (right or wrong), solved, or self-rated.
- **Item points**: 1 if the first Check was fully correct, otherwise 0. Solved = 0. A correct retry after a wrong Check = 0, but is stored as an attempt.
- **Scorable item**: any item that is not self-rated. Self-rated exercises (`speak_rate` exchanges, `parla`) count in "X of Y" but never in points or the % denominator, so *Bene* is not a free point.
- **Step completed**: every exercise in the step is completed.
- **Lesson %** = round-half-up(100 × points ÷ number of scorable items). Unattempted items count as 0.
- **Results S/M**: S = completed steps, M = total steps.
- **Lesson status**: `not_started` (nothing touched), `in_progress`, `completed` (Finish screen reached). Store both `last_percent` and `best_percent`.
- **Level %** = completed lessons ÷ the level's total **planned** lessons (sum of `planned_lessons` over its units; 30 for Ripasso A2), so it reflects progress through the whole course, not just the lessons written so far.

### 6.2 Exact footer text
`{completed} di {total} esercizi completati. {points} punti.` The noun agrees with the total and *punti* with the points: *0 di 1 esercizio completato*, *1 di 9 esercizi completati*, *1 punto*.

### 6.3 Language rule (ADR-0003)
**Teaching text and translations are in English; everything else is in Italian.**

| Italian | English |
|---|---|
| all chrome: buttons, menus, page headers, footer, results lines, dialogs | grammar page prose and `terms` definitions |
| step `title` and `instruction` | note text (Info, Consiglio, Attenzione!), because notes explain grammar |
| intro page: topic, summary, objectives | error-tag explanations |
| lesson card topic line, grammar label | vocab meanings, script line translations, *Parole nuove* glosses |
| `speak_rate` `hint`; `parla` `task` and `checklist` | the culture page |
| note labels: *Info · Consiglio · Parole nuove · Attenzione!* | optional `instruction_en` (behind the EN toggle) |
| prompts, dialogues, options, reading texts, vocab terms | |

All UI strings live in one module (`ui-it.ts`), never inline in components. There is no "instruction language" setting.

---

## 7. Reference page layouts

**Level overview** (`[01]`, `[03]`)
```
┌──────────────────────────────────────────────────────┐
│ logo            La strada di Adam                  ☰ │
├──────────────────────────────────────────────────────┤
│ Ripasso A2 / Course                                  │
│ ┌──────────────────────────────────────────────────┐ │
│ │ (A2)        hero illustration          [logo]   │ │
│ └──────────────────────────────────────────────────┘ │
│                                         [Reset] ○    │
│ Benvenuto!         │ 1 Arrivo a Genova │ 2 Una casa… │
│ ┌───────────────┐  │ ┌───────────────┐ │ ┌─────────┐ │
│ │Ciao!        ○ │  │ │Benvenuto a  ○ │ │ │ …     ○ │ │
│ │Greetings      │  │ │Genova!        │ │ │         │ │
│ │Formal/informal│  │ │Arriving…      │ │ │         │ │
│ └───────────────┘  │ │Articles…      │ │ └─────────┘ │
└──────────────────────────────────────────────────────┘
```

**Exercise step** (`[10]`, `[16]`)
```
┌ lesson bar ─────────  Benvenuto a Genova!  ─────────── ⌄ ┐
  A2 / Corso / Benvenuto a Genova! / il, lo, l' o la?
                           2 / 6
  il, lo, l' o la?
  Scegli l'articolo determinativo giusto.              [EN]
  Copione ⌄
  ┌prompt bubble──────┐      ┌text panel────────────────┐
  │ Che cosa ha Adam? │      │ [… ▾] valigia, [… ▾] …   │
  └───────────────────┘      └──────────────────────────┘
   ⓘ Attenzione! Before a vowel, il and la become l'.
                  [Soluzione] [Controlla]
░░░░░░      0 di 1 esercizio completato. 0 punti.          ░░░░
░░░░░░                    [Avanti]                        ░░░░
                           2 / 6
```

**Results / Finish** (`[18]`, `[46]`): heading, encouragement line, a slate panel with "87%" and *Risultati della lezione: 9/9*, then the buttons.

### 7.1 Visual design
- Keep DW's **layout grammar**: a narrow centred column (~720 px) for exercises, wide media (~960 px), a tinted full-width footer band, speech-bubble prompts with a tail, light-tinted pill option buttons, an accent colour for Check/Next/Finish, and a dark link colour for titles.
- Use **our own palette, type and logo**. Suggestion: Ligurian blue `#0B4F8A` (links, lesson bar on a lighter `#3D8BD9`), focaccia yellow `#F6C94C` (accent buttons and bubble borders), slate `#5B6670` (results panel), green `#3BB273` / red `#E5484D` (feedback).
- All interactions must work with the keyboard and show visible focus.

---

## 8. Tech stack (decided, ADR-0001)

**Next.js (App Router) + TypeScript**, run locally with `npm run dev`.
- One process gives both the UI and a small server-side API (Route Handlers or Server Actions). That matters because the **Neon connection string must stay on the server**, never in the browser.
- File-based routes map 1:1 onto `/:level/:lesson/esercizi/:n`.
- Lesson JSON is read from disk on the server, with no CMS needed.

Supporting pieces:
- **Drizzle ORM** with Neon's **HTTP driver** (`@neondatabase/serverless`, `drizzle-orm/neon-http`). It talks HTTPS on port 443, which a locked-down work network is far more likely to allow than Postgres's port 5432. SQL migrations live in the repo.
- **Zod** for the content schema, plus `npm run content:check` to validate every lesson file, check ID uniqueness, and check that every referenced media file exists.
- **Tailwind CSS** + a few headless primitives (dialog, popover, drawer).
- **Vitest** for answer comparison and scoring (pure functions, no DB); **Playwright** for one end-to-end lesson. `npm run test:db` (local only) checks migrations and the seed against the `dev` branch.

Rejected: Vite + React SPA plus a Hono API server (two processes, hand-rolled routing).

**Databases.** One Neon project with two branches: `main` holds my real progress (`DATABASE_URL`), `dev` is for experiments and Playwright runs (`DATABASE_URL_TEST`). There is no login: the seed script creates one `profile` row with a fixed UUID, and every request uses it.

Per-computer setup: `git clone` → `npm i` → copy `.env.example` to `.env.local` and set `DATABASE_URL` and `DATABASE_URL_TEST` → `npm run db:migrate` (once per branch; add `-- --test` for the `dev` branch) → `npm run db:seed` (likewise) → `npm run dev`. Never commit `.env*`.

**Sync resilience.** Progress writes are optimistic: the UI updates first, the write follows.
- **M1:** a failed write is kept in memory and retried every 30 s until it succeeds or the tab closes. The footer shows *Salvato* / *In attesa* / *Offline: non salvato*.
- **M2:** the same queue persists to IndexedDB, so pending writes survive a reload.
  - A write is stored in IndexedDB *before* it is sent and deleted once the server acknowledges it.
  - On load, pending writes are **laid over the server state** with the conflict rule below, so the UI shows them at once; then they are replayed in order. Replays are safe because every write carries an `eventId` (the `exercise_attempt` id).
  - Only one tab flushes, coordinated with the Web Locks API.
  - While a stored write waits, the footer says *Offline: salvato su questo computer*.
  - Without IndexedDB (private window, blocked storage) the app falls back silently to the M1 in-memory queue and its *Offline: non salvato* label.
  - Review writes (10.5) and feedback notes (10.6) go through the same queue.
- Conflict rule per item: the earliest `first_check_correct` wins, and the latest state wins for everything else. "Earliest" is the time the learner acted on their own computer, sent with each write, so a Check made offline and synced late still counts as first.

---

## 9. Content model and file layout

```
content/
  course.json                      # levels → units (in order), each with planned_lessons and its lesson ids
  characters.json                  # names, TTS voice ids, illustration style notes
  error-tags.json                  # tag → English explanation + link to the unit/grammar page that teaches it
  levels/a2/units/01-arrivo-a-genova/
      unit.json                    # unit number, title, description, planned_lessons
      lessons/01-benvenuto-a-genova.json
  media/
    images/a2/u01/l01/poster.webp, panel-01.webp, …
    audio/a2/u01/l01/<hash>.mp3    # generated, see §11
```

`course.json` lists **every unit from the course plan** (`docs/course-plan.md`), including units with no lesson files yet, so the level overview can show them as *In arrivo* and the level % can use the planned total.

IDs are stable and hierarchical: lesson `a2.u01.l01`, step `a2.u01.l01.s03`, item `a2.u01.l01.s03.i02`, speaking exchange `a2.u01.l01.s05.i01.e2`, gap `g1`. **Never change an ID once progress exists.** Bump the lesson's `version` when content changes; it is kept as a record. Staleness is detected per item by content hash (10.3), so forgetting to bump `version` breaks nothing.

### 9.1 Lesson file schema (TypeScript notation; implement with Zod)

Field language follows the rule in 6.3: fields without a suffix hold Italian; fields ending in `_en` hold English.

```ts
type Course = {
  levels: {
    id: "a2" | "b1" | "b2"; title: string; description: string;
    units: { id: string; number: number; title: string; planned_lessons: number; lessons: string[] /* lesson ids, may be empty */ }[];
  }[];
};

type Lesson = {
  id: string;                 // "a2.u01.l01"
  version: number;
  status: "draft" | "ready";  // drafts show a Bozza badge; both are playable and validated
  slug: string;               // "benvenuto-a-genova"
  title: string;              // card + lesson bar
  topic: string;              // card line 1 / intro heading
  grammar_label?: string;     // card line 2
  summary: string;            // intro page
  objectives: string[];       // intro page, "In questa lezione impari a…"
  scene: Scene;
  steps: Step[];
  grammar: GrammarPage[];
  vocab: VocabEntry[];
  culture?: CulturePage;
};

type Scene = {
  poster: string;             // path under content/media
  duration_s: number;         // real duration once audio exists; otherwise estimated (§11.3)
  panels: { image: string; from_line: string }[];   // panel shown from this line id onward
  lines: ScriptLine[];
};
type ScriptLine = { id: string; speaker: string; it: string; en: string; audio?: string };

type Step = {
  id: string;
  title: string;
  instruction: string;
  instruction_en?: string;    // shown behind the EN toggle; only for tricky instructions
  media?:
    | { kind: "scene" }
    | { kind: "image"; src: string; alt: string }
    | { kind: "clip"; from_line: string; to_line: string };   // audio-only clip player, M2
  script?: "scene" | ScriptLine[];          // what the collapsible Copione shows
  reading?: string;                          // markdown document (reading steps)
  items: Item[];
};

type Note = { kind: "info" | "tip" | "new_words" | "attenzione"; text_en: string; error_tag?: string };

type ItemBase = {
  id: string; prompt?: string; prompt_audio?: string; image?: string;
  notes?: Note[]; error_tags?: string[]; solvable?: boolean;
};

type Gap = { id: string; answer: string; accept?: string[]; case_sensitive?: boolean };

type Exchange = {
  id: string;                 // "e1"; full exercise id = item id + "." + exchange id
  other: string; other_audio?: string;
  me: string; me_audio?: string;
  hint?: string;
  notes?: Note[];             // rendered between this exchange and its rating
};

type Item = ItemBase & (
  | { type: "dropdown";  text: string; gaps: (Gap & { options: string[] })[] }   // text uses {{g1}} markers
  | { type: "text_gap";  text: string; gaps: Gap[]; layout?: "default" | "full" }
  | { type: "word_bank"; text: string; bank: string[]; gaps: Gap[] }
  | { type: "audio_gap"; clip: { from_line: string; to_line: string }; text: string; gaps: Gap[] }
  | { type: "word_order"; tiles: string[] /* correct order; the app shuffles */; accept?: string[][]; layout?: "words" | "lines" }
  | { type: "single_choice" | "image_choice"; options: string[]; answer: number }
  | { type: "audio_choice"; options: string[]; answer: number; clip?: { from_line: string; to_line: string } }   // clip: M2
  | { type: "multi_select"; options: string[]; answers: number[] }
  | { type: "speak_rate"; variant: "dialogue" | "read_along" | "personal"; exchanges: Exchange[] }
  | { type: "parla"; task: string; example: string; checklist: string[] }
);

type GrammarPage = { id: string; title: string; blocks: GrammarBlock[] };
type GrammarBlock =
  | { kind: "text"; md: string }
  | { kind: "example"; image?: string; it: string /* **bold** = target form */; en?: string }
  | { kind: "table"; columns: string[]; rows: string[][] }
  | { kind: "rule"; rows: RuleSegment[][]; arrows?: RuleArrow[] }   // rendered as SVG
  | { kind: "terms"; items: { term: string; def_en: string }[] };   // full-width block at the page bottom

type RuleSegment = { text: string; style?: "plain" | "bold" | "italic" | "highlight" };
type RuleArrow = {
  from: [row: number, segment: number];
  to: [row: number, segment: number];
  kind: "down" | "diagonal" | "swap";       // M1 implements "down" only
};

type VocabEntry = {
  id: string; it: string /* "la valigia" */; plural?: string; gender?: "m" | "f";
  pos: "noun" | "verb" | "adj" | "adv" | "phrase" | "other";
  forms?: string;             // free text: verb forms, "solo singolare", "dal genovese", …
  sort_key?: string;          // overrides the default sort (headword without its article)
  en: string; image?: string; audio?: string;
};

type CulturePage = { title: string; image: string; md: string };   // English prose
```

- `{{g1}}` marks a gap inside `text`; `\n` is a line break; `**SPEAKER:**` prefixes are allowed in dialogue texts.
- Vocab links (M2): any `[[word|v-id]]` in prompts, readings, script lines or gap-item `text` (outside gap markers) renders as a highlighted vocab link (4.3). The content hash ignores this markup (10.3).
- `audio` / `*_audio` fields are filled in by the audio script (§11), never by hand. Omit them while drafting.
- Validation rules: every `answer` must be one of `options` for dropdowns, every gap marker must have a gap entry, `answers` indexes must be in range, exchange ids are unique within their item, `rule` arrow indexes point at existing segments, `clip` line ids exist in the scene and run forward, every vocab link's `v-id` is in the same lesson's `vocab` and no link sits in options, tiles or gap answers (M2), every lesson id in `course.json` has a file and vice versa, and the last step must contain a `parla` item.

### 9.2 Example lesson: Ripasso A2, Unit 1 "Arrivo a Genova", Lesson 1

Story beat from the course plan: Adam arrives at Genova Piazza Principe and meets his landlady, Signora Pina. Grammar: definite articles *il / lo / l' / la · i / gli / le*. It's shortened to 6 steps here; real lessons have 8–11.

```json
{
  "id": "a2.u01.l01",
  "version": 1,
  "status": "ready",
  "slug": "benvenuto-a-genova",
  "title": "Benvenuto a Genova!",
  "topic": "Arrivare a Genova e salutare",
  "grammar_label": "Articoli: il, lo, l', la · i, gli, le",
  "summary": "Adam scende dal treno a Genova Piazza Principe. La sua padrona di casa, la signora Pina, lo aspetta sul binario. È curiosa, parla veloce e ha le sue opinioni sui bagagli.",
  "objectives": [
    "salutare in modo formale e presentarti",
    "scegliere l'articolo determinativo giusto: il, lo, l', la",
    "formare gli articoli plurali: i, gli, le",
    "nominare le cose del viaggio: la valigia, lo zaino, l'ombrello"
  ],
  "scene": {
    "poster": "images/a2/u01/l01/poster.webp",
    "duration_s": 58,
    "panels": [
      { "image": "images/a2/u01/l01/panel-01.webp", "from_line": "L1" },
      { "image": "images/a2/u01/l01/panel-02.webp", "from_line": "L5" },
      { "image": "images/a2/u01/l01/panel-03.webp", "from_line": "L8" }
    ],
    "lines": [
      { "id": "L1",  "speaker": "pina", "it": "Buongiorno! Lei è Adam, vero?", "en": "Good morning! You're Adam, right?" },
      { "id": "L2",  "speaker": "adam", "it": "Sì, sono io. Buongiorno, signora Pina!", "en": "Yes, that's me. Good morning, Signora Pina!" },
      { "id": "L3",  "speaker": "pina", "it": "Benvenuto a Genova! Com'è andato il viaggio?", "en": "Welcome to Genoa! How was the journey?" },
      { "id": "L4",  "speaker": "adam", "it": "Bene, grazie. Il treno era un po' in ritardo, ma va bene così.", "en": "Fine, thanks. The train was a bit late, but that's OK." },
      { "id": "L5",  "speaker": "pina", "it": "Ha tutto? La valigia, lo zaino…?", "en": "Have you got everything? The suitcase, the backpack…?" },
      { "id": "L6",  "speaker": "adam", "it": "Sì: la valigia, lo zaino e l'ombrello.", "en": "Yes: the suitcase, the backpack and the umbrella." },
      { "id": "L7",  "speaker": "pina", "it": "L'ombrello? Bravo, a Genova serve!", "en": "The umbrella? Good, you need one in Genoa!" },
      { "id": "L8",  "speaker": "pina", "it": "Allora andiamo: l'appartamento è vicino, nei caruggi.", "en": "Let's go then: the flat is close by, in the caruggi." },
      { "id": "L9",  "speaker": "adam", "it": "I caruggi?", "en": "The caruggi?" },
      { "id": "L10", "speaker": "pina", "it": "Sì, i vicoli del centro storico. Gli stranieri si perdono sempre!", "en": "Yes, the alleys of the old town. Foreigners always get lost!" },
      { "id": "L11", "speaker": "adam", "it": "Allora resto con Lei, signora!", "en": "Then I'll stick with you, signora!" }
    ]
  },
  "steps": [
    {
      "id": "a2.u01.l01.s01",
      "title": "Arrivo a Genova",
      "instruction": "Guarda la scena e rispondi alle domande.",
      "media": { "kind": "scene" },
      "script": "scene",
      "items": [
        {
          "id": "a2.u01.l01.s01.i01", "type": "single_choice",
          "prompt": "Prima di guardare: secondo te, chi aspetta Adam alla stazione?",
          "options": ["La padrona di casa", "Un collega di lavoro", "Nessuno"],
          "answer": 0
        },
        {
          "id": "a2.u01.l01.s01.i02", "type": "single_choice",
          "prompt": "Com'è andato il viaggio di Adam?",
          "options": ["Bene, ma il treno era in ritardo.", "Male: ha perso il treno.", "Benissimo, il treno era in anticipo."],
          "answer": 0
        },
        {
          "id": "a2.u01.l01.s01.i03", "type": "multi_select",
          "prompt": "Che cosa ha Adam con sé? Ci sono tre risposte giuste.",
          "options": ["la valigia", "la bicicletta", "lo zaino", "l'ombrello"],
          "answers": [0, 2, 3],
          "notes": [{ "kind": "new_words", "text_en": "con sé = with him, on him" }]
        }
      ]
    },
    {
      "id": "a2.u01.l01.s02",
      "title": "il, lo, l' o la?",
      "instruction": "Scegli l'articolo determinativo giusto.",
      "script": "scene",
      "items": [
        {
          "id": "a2.u01.l01.s02.i01", "type": "dropdown",
          "prompt": "Che cosa ha Adam?",
          "text": "{{g1}} valigia, {{g2}} zaino, {{g3}} ombrello e {{g4}} computer.",
          "gaps": [
            { "id": "g1", "options": ["il", "lo", "l'", "la"], "answer": "la" },
            { "id": "g2", "options": ["il", "lo", "l'", "la"], "answer": "lo" },
            { "id": "g3", "options": ["il", "lo", "l'", "la"], "answer": "l'" },
            { "id": "g4", "options": ["il", "lo", "l'", "la"], "answer": "il" }
          ],
          "error_tags": ["article.elision", "article.lo"],
          "notes": [{ "kind": "attenzione", "text_en": "Before a vowel, il and la become l': l'ombrello, l'appartamento.", "error_tag": "article.elision" }]
        }
      ]
    },
    {
      "id": "a2.u01.l01.s03",
      "title": "Una valigia, due valigie",
      "instruction": "Scrivi l'articolo plurale: i, gli o le.",
      "items": [
        {
          "id": "a2.u01.l01.s03.i01", "type": "text_gap",
          "image": "images/a2/u01/l01/caruggi.webp",
          "prompt": "Scrivi l'articolo plurale.",
          "text": "il vicolo → {{g1}} vicoli\nlo zaino → {{g2}} zaini\nl'appartamento → {{g3}} appartamenti\nla valigia → {{g4}} valigie\nlo straniero → {{g5}} stranieri",
          "gaps": [
            { "id": "g1", "answer": "i" },
            { "id": "g2", "answer": "gli" },
            { "id": "g3", "answer": "gli" },
            { "id": "g4", "answer": "le" },
            { "id": "g5", "answer": "gli" }
          ],
          "error_tags": ["article.plural_gli"],
          "notes": [{ "kind": "info", "text_en": "Both lo and masculine l' become gli in the plural: gli zaini, gli appartamenti." }]
        }
      ]
    },
    {
      "id": "a2.u01.l01.s04",
      "title": "Com'è andato il viaggio?",
      "instruction": "Metti le parole nell'ordine giusto per rispondere alla signora Pina.",
      "items": [
        {
          "id": "a2.u01.l01.s04.i01", "type": "word_order",
          "prompt": "Com'è andato il viaggio?",
          "tiles": ["Bene,", "grazie,", "ma", "il treno", "era", "in ritardo", "."]
        },
        {
          "id": "a2.u01.l01.s04.i02", "type": "word_order",
          "prompt": "Dov'è l'appartamento?",
          "tiles": ["L'appartamento", "è", "vicino,", "nel", "centro storico", "."],
          "error_tags": ["article.elision", "prep.articulated"]
        }
      ]
    },
    {
      "id": "a2.u01.l01.s05",
      "title": "Tocca a te: incontri la padrona di casa",
      "instruction": "Ascolta la signora Pina, rispondi ad alta voce e completa con i tuoi dati. Poi valuta come è andata.",
      "instruction_en": "Listen to Signora Pina, answer aloud and complete with your own details. Then rate yourself.",
      "items": [
        {
          "id": "a2.u01.l01.s05.i01", "type": "speak_rate", "variant": "dialogue",
          "exchanges": [
            { "id": "e1", "other": "Buongiorno! Lei è …, vero?", "me": "Sì, sono io. Buongiorno, signora!",
              "notes": [{ "kind": "tip", "text_en": "Signora Pina uses Lei (formal). Stay formal too: E Lei?" }] },
            { "id": "e2", "other": "Com'è andato il viaggio?", "me": "Bene, grazie. Il treno / L'aereo era …" },
            { "id": "e3", "other": "Ha tutto?", "me": "Sì: la valigia, lo zaino e …", "hint": "Nomina 2–3 cose, sempre con l'articolo." }
          ],
          "error_tags": ["article.elision", "register.lei"]
        }
      ]
    },
    {
      "id": "a2.u01.l01.s06",
      "title": "Parla! Il tuo arrivo",
      "instruction": "Parla liberamente per circa un minuto, poi valuta come è andata.",
      "items": [
        {
          "id": "a2.u01.l01.s06.i01", "type": "parla",
          "task": "Un collega di Energetica Ligure ti chiama e ti chiede com'è andato il tuo arrivo a Genova. Raccontagli il viaggio, che cosa hai portato e la tua prima impressione dell'appartamento e dei caruggi.",
          "example": "Il viaggio è andato bene, ma il treno era in ritardo. Ho portato la valigia, lo zaino e l'ombrello. L'appartamento è nel centro storico, in un caruggio molto stretto…",
          "checklist": ["Usa l' davanti a vocale almeno due volte", "Usa un plurale con gli", "Usa era almeno una volta"],
          "error_tags": ["article.elision", "article.plural_gli"]
        }
      ]
    }
  ],
  "grammar": [
    {
      "id": "a2.u01.l01.gr1",
      "title": "Articoli determinativi: il, lo, l', la",
      "blocks": [
        { "kind": "example", "image": "images/a2/u01/l01/gr-luggage.webp", "it": "Sì: **la** valigia, **lo** zaino e **l'**ombrello.", "en": "Yes: the suitcase, the backpack and the umbrella." },
        { "kind": "table", "columns": ["", "Masculine", "Feminine"],
          "rows": [
            ["before a consonant", "il treno", "la valigia"],
            ["before s + consonant, z, gn, ps, y", "lo zaino, lo straniero", "la stazione"],
            ["before a vowel", "l'ombrello, l'appartamento", "l'agenzia"]
          ] },
        { "kind": "text", "md": "Italian chooses the article from the **gender** of the noun and its **first sound**. The most common mistake is *il* before a vowel: it is always **l'**, as in *l'asset*, *l'ufficio*." },
        { "kind": "terms", "items": [{ "term": "elision", "def_en": "dropping a vowel before another vowel and writing an apostrophe: lo + ombrello → l'ombrello" }] }
      ]
    },
    {
      "id": "a2.u01.l01.gr2",
      "title": "Plurale: i, gli, le",
      "blocks": [
        { "kind": "table", "columns": ["Singular", "Plural"],
          "rows": [["il vicolo", "i vicoli"], ["lo zaino", "gli zaini"], ["l'appartamento", "gli appartamenti"], ["la valigia", "le valigie"], ["l'agenzia", "le agenzie"]] },
        { "kind": "rule",
          "rows": [
            [{ "text": "lo", "style": "highlight" }, { "text": " straniero" }],
            [{ "text": "gli", "style": "highlight" }, { "text": " stranieri" }]
          ],
          "arrows": [{ "from": [0, 0], "to": [1, 0], "kind": "down" }] },
        { "kind": "text", "md": "**lo** and masculine **l'** both become **gli**. Feminine **l'** becomes **le**, with no apostrophe." }
      ]
    }
  ],
  "vocab": [
    { "id": "v-appartamento", "it": "l'appartamento", "plural": "gli appartamenti", "gender": "m", "pos": "noun", "en": "flat, apartment" },
    { "id": "v-caruggio", "it": "il caruggio", "plural": "i caruggi", "gender": "m", "pos": "noun", "forms": "dal genovese", "en": "narrow alley in Genoa's old town" },
    { "id": "v-ombrello", "it": "l'ombrello", "plural": "gli ombrelli", "gender": "m", "pos": "noun", "en": "umbrella" },
    { "id": "v-perdersi", "it": "perdersi", "pos": "verb", "forms": "mi perdo, si perde, mi sono perso/a", "en": "to get lost" },
    { "id": "v-ritardo", "it": "in ritardo", "pos": "phrase", "sort_key": "ritardo", "en": "late, delayed" },
    { "id": "v-straniero", "it": "lo straniero", "plural": "gli stranieri", "gender": "m", "pos": "noun", "en": "foreigner (male)" },
    { "id": "v-valigia", "it": "la valigia", "plural": "le valigie", "gender": "f", "pos": "noun", "en": "suitcase" },
    { "id": "v-viaggio", "it": "il viaggio", "plural": "i viaggi", "gender": "m", "pos": "noun", "en": "journey, trip" },
    { "id": "v-vicolo", "it": "il vicolo", "plural": "i vicoli", "gender": "m", "pos": "noun", "en": "alley, lane" },
    { "id": "v-zaino", "it": "lo zaino", "plural": "gli zaini", "gender": "m", "pos": "noun", "en": "backpack" }
  ],
  "culture": {
    "title": "Genova Piazza Principe and the caruggi",
    "image": "images/a2/u01/l01/culture-caruggi.webp",
    "md": "Many trains from Milan and Turin arrive at **Genova Piazza Principe**, a short walk from the old town. Genoa's **centro storico** is one of the largest medieval old towns in Europe: a maze of narrow alleys called **caruggi**. Many are too narrow for cars, so moving in often means carrying your suitcase through the alleys and up several flights of stairs."
  }
}
```

---

## 10. Data model (Neon Postgres)

There's a single user, but every table keeps a `user_id` so a second profile stays possible. **Content is not in the DB.** Rows reference content IDs from the JSON files.

### 10.1 `profile`
| column | type | notes |
|---|---|---|
| id | uuid PK | one row, with a fixed UUID created by `npm run db:seed`; there is no login |
| display_name | text | |
| settings | jsonb | synced settings (M2): `inject_review` (Ripasso personale on/off, default on), default subtitles (`off` · `it` · `it_en`), default scene speed (0.75 · 1). Recording on/off comes with recordings (M3). The Italian `speechSynthesis` voice is chosen per computer and kept in `localStorage`, because each machine has different voices. |
| created_at | timestamptz | |

### 10.2 `lesson_progress`
| column | type | notes |
|---|---|---|
| user_id | uuid FK | |
| lesson_id | text | `a2.u01.l01` |
| content_version | int | |
| status | text | `not_started` · `in_progress` · `completed` |
| last_location | text | resume point, e.g. `esercizi/3` |
| review_items | text[], nullable | M2: the item ids frozen for this lesson's Ripasso personale step (10.5); null = not chosen yet, empty = no step |
| last_percent | int | |
| best_percent | int | |
| started_at, completed_at, updated_at | timestamptz | |
| PK | (user_id, lesson_id) | |

### 10.3 `item_state` (current state) and `exercise_attempt` (history)
**`item_state`**: `user_id`, `item_id`, `lesson_id`, `status` (`untouched` · `checked_correct` · `checked_wrong` · `solved` · `rated_good` · `rated_not_great`), `first_check_correct` bool, `points` smallint (0/1), `answer` jsonb (current inputs, to restore the UI), `content_hash` text, `updated_at`. PK (user_id, item_id). Reset deletes these rows for the lesson.
- `item_id` is the id of one **exercise**: an item id, or for speaking items an exchange id (`a2.u01.l01.s05.i01.e2`).
- `content_hash` is a hash of that exercise's content when the row was written. Notes are left out, since they explain an item without changing it, and so is vocab-link markup: `[[word|v-id]]` hashes as `word`, so adding links never resets progress (ADR-0006). On load, a row whose hash no longer matches the current content is ignored, and the exercise shows as untouched. Every other exercise in the lesson keeps its state.

**`exercise_attempt`** (append-only, never reset): `id`, `user_id`, `item_id`, `lesson_id`, `content_version`, `action` (`check` · `solve` · `rate` · `reset` · `review` (M2: an answer given in the Review hub or a Ripasso personale step)), `answer` jsonb, `result` jsonb (per-gap correct/incorrect), `correct` bool, `created_at`.

### 10.4 `error_log`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| source | text | `exercise` · `speak_rate` · `parla` · `parla_note` · `manual` · `ai` (future) |
| lesson_id, item_id, gap_id | text, nullable | |
| error_tags | text[] | e.g. `{article.elision}` |
| expected | text | `l'ombrello` |
| given | text | `il ombrello` |
| note | text | |
| resolved | bool | set when the review card behind the row gets 3 non-*again* grades in a row (10.5); never cleared |
| created_at | timestamptz | |

The initial tags (in `content/error-tags.json`, each with an English explanation and a link to its grammar page; `spelling.accent` and `speaking` have no teaching unit for now, so no link) come from the course plan's "weak points" table: `article.elision`, `article.lo`, `article.plural_gli`, `partitive.masc_plural`, `gender.anglicism`, `prep.articulated`, `agreement.plural`, `congiuntivo.volere_che`, `lexis.invented_word`, `lexis.english_fallback`, `register.lei`, `verb.conjugation`, `spelling.accent`, `speaking`.

The `manual` source lets me paste corrections from voice sessions with my Italian tutor bot (e.g. "*voglio che tu esse* → *voglio che tu sia*") into a small form in the Review hub.

### 10.5 `review_card` (spaced review)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| kind | text | `vocab` · `item` (re-ask an exercise item) · `error` (a card built from an error_log row: given → expected) |
| ref_id | text | vocab id, item id or error_log id |
| due_at | timestamptz | |
| interval_days, ease, reps, lapses | numeric / int | SM-2 to start; `ts-fsrs` is a drop-in upgrade |
| last_result | text | `again` · `hard` · `good` · `easy` |
| streak | int | non-*again* grades in a row; 3 marks the card's error_log rows resolved (10.4) |
| created_at, updated_at | timestamptz | |
| UNIQUE | (user_id, kind, ref_id) | |

For `item` cards, `ref_id` is an **exercise** id: an item id, or an exchange id for speaking items. For `vocab` cards it is the lesson id plus the vocab id, e.g. `a2.u01.l01.v-ombrello`, because vocab ids are only unique inside their lesson.

**`review_log`** (append-only, never reset): `id` (the write's `eventId`), `user_id`, `card_id`, `grade`, `interval_before`, `interval_after`, `ease_before`, `ease_after`, `source` (`hub` · `drill` · `ripasso_personale` · `lesson`: a lesson answer that grades an existing item card *again*), `created_at`. Every review writes one row, so the scheduler can later be swapped for FSRS fitted to this history (ADR-0004).

**Scheduler (SM-2, ADR-0004).** One pure function with Vitest cases.
- A new card starts with ease 2.5; ease never drops below 1.3.
- *again*: interval 1 (due tomorrow), ease −0.2, lapses +1, reps back to 0.
- *hard*: interval × 1.2, ease −0.15.
- *good*: 1 day, then 6 days, then interval × ease.
- *easy*: the *good* interval × 1.3, ease +0.15.
- Intervals are capped at 180 days and get ±5 % fuzz (seeded by card id and reps, so tests are deterministic).

**Grading.** Wherever the app can check an answer, it grades automatically; there are no extra buttons.

| What happened in the review | Grade |
|---|---|
| First Check fully correct | *good* |
| Accent-only miss (5.1) | *hard* |
| Wrong, or Soluzione | *again* |
| Speaking exchange: *Bene* / *Non tanto bene* | *good* / *again* |
| Vocab card: the learner presses *Ancora · Difficile · Bene · Facile* | *again* · *hard* · *good* · *easy* |

A review **never touches the lesson's `item_state`** or its %: it writes `review_log`, an `exercise_attempt` row with action `review`, and the card's new schedule. A wrong review answer writes no new error_log row; the card's lapse already records it. If an item's content changed since the card was made, the review shows the current content.

**Card kinds.**
- **`vocab`**: finishing a lesson creates one per vocab entry, first due the next day. The card is a flip card. The front shows the English meaning, with no gender dot. I say the Italian aloud and flip. The back shows the term with article and plural, the forms line and 🔊. Then I press one of the four grade buttons. The vocab trainer (M4) adds typed and listening modes on the same cards.
- **`item`**: re-asks one exercise in the normal item UI. It is created or reset by a wrong first Check, a *Non tanto bene* rating, or **Soluzione before any Check**. Reset means grading the existing card *again*. Accent-only misses never create or reset a card.
- **`error`**: built from an error_log row that has both `given` and `expected`, so `manual` now and `ai` later. Rows from exercises and speaking feed item cards instead, and `parla_note` rows are only logged. The card shows my wrong version struck through in red, with the tag's English explanation behind an *Info* toggle. I type the corrected sentence, which is checked with the normal compare rules (5.1).
- **Backfill:** when review cards ship, lessons already completed get their vocab cards, and unresolved error_log rows from `exercise` and `speak_rate` get item cards, all due the next day.

**Review hub (`/ripasso`)**: one page with three panels. It is reachable from the hamburger, the lesson menu's *Altri strumenti* and the overview's *Altre lezioni*.
1. **Da ripassare oggi**: counts of due cards by kind and an *Inizia il ripasso* button. A **review session** is up to 20 due cards, mixed and shuffled, shown one at a time. It ends on a summary, with *Altri 20* if more are due.
2. **I miei errori più frequenti**: the top 5 error tags by **unresolved** error_log rows in the last 30 days, with counts and English explanations, so a tag drops off as I fix it. Clicking a tag starts a **tag drill**: up to 10 items with that tag from completed lessons. A drill is graded like a review and updates the card of any item that already has one (`source = drill`). It doesn't create cards.
3. **Aggiungi una correzione**: *Cosa hai detto* (`given`), *Versione corretta* (`expected`), a multi-select of tags from `error-tags.json` and an optional note. Saving writes an error_log row (`source = manual`) and its error card, due tomorrow.

**Ripasso personale step (ADR-0005).** The app inserts an extra step before *Parla!*, titled *Ripasso personale*, with an instruction saying the items come from my mistakes. This implements the course plan's "plus 2–3 items drawn from your own error log". It is **on by default** from M2; `settings.inject_review` turns it off.
- **Which cards:** up to 3 due `item` cards from *other* lessons whose item tags overlap this lesson's tags (the union of its items' `error_tags`), most overdue first. If none match, any due item cards. With no due item cards, there is no step.
- **When chosen:** the first time I open the lesson. The ids are stored in `lesson_progress.review_items`, so the step count stays stable across reloads and both computers. Azzera and finishing the lesson clear the choice; the next visit chooses again.
- **Scoring:** its exercises count in the footer's *X di Y* but are **not scorable**. They earn no points and stay out of the lesson %, the Results S/M and *Correggi i miei errori*. Each answer grades its card (`source = ripasso_personale`).

### 10.6 `feedback_note`
`id`, `user_id`, `scope` (`level` · `lesson` · `item`), `ref_id`, `text`, `created_at`, `done` bool. These are my notes about content to fix (M2).
- **Level overview** Feedback card: a textarea, `scope = level`, `ref_id` = the level id.
- **Lesson menu → *Segnala un problema***: a dialog with a textarea. `scope = lesson`, and `ref_id` is the lesson id plus the current page, e.g. `a2.u01.l02/esercizi/4`. There are no per-item buttons; `item` stays in the schema for later.
- **`/feedback`**: open notes grouped by lesson, each with a *Fatto* toggle that sets `done`.
- **`npm run feedback:list`**: prints open notes as Markdown, so a content-fixing agent can read them. It is read-only, against `DATABASE_URL`.

---

## 11. Audio and image assets (recommendations)

### 11.1 Audio: TTS generated when authoring, committed as files
- `npm run content:audio` walks every lesson file. For each script line, prompt with audio, speak_rate exchange and vocab entry it computes `hash(text + voice + speed)`. If `media/audio/<level>/<unit>/<lesson>/<hash>.mp3` is missing, it calls the TTS provider and saves the file, then writes the path into a sidecar `audio-map.json` (so lesson JSON stays hand-editable). It's idempotent: only changed lines regenerate.
- **Before any MP3 exists** (M1), every 🔊 button and the scene player fall back to the browser's built-in `speechSynthesis` with an Italian voice (Windows Edge and Chrome ship one). No API keys are needed. A generated MP3, when present, always wins.
- **Voices are standard Italian.** TTS can't reliably do a regional accent, so Genoese colour goes into the dialogue text instead (*belin*, *mugugno*, *caruggi*).
- Providers (pick one, decided before M3): **Azure Speech** or **Google Cloud TTS** (good Italian neural voices, cheap, SSML for pauses), **ElevenLabs** (most natural, pricier) or **OpenAI TTS**. Each character gets a fixed voice in `characters.json`: Pina older female, Giulia female, Marco fast male, Elena precise female, Adam male, Sofia female with a Spanish touch if available.
- Scene audio = line clips joined with ~400 ms gaps. The script records each line's start time so panels, subtitles and `audio_gap` clips can sync.
- Vocab audio at 0.9× speed.
- TTS API keys live only in `.env.local` and are used only by the script. The running app needs no AI keys.
- Size: 48–64 kbps mono mp3 ≈ 0.5 MB per lesson. Switch `media/**` to **Git LFS** if the repo passes ~1 GB.

### 11.2 Images: generated illustrations with one fixed style
- `content/style-guide.md`: a flat or semi-flat editorial illustration style, a warm Ligurian palette, and **character model sheets** (Adam, Giulia, Marco, Elena, Pina, Luca, Sofia) with fixed faces, hair and clothes, plus reference images for each.
- Per lesson: 1 poster (16:9, 1600 px), 3–6 scene panels, 0–4 item images (800 px), 1–2 grammar example images, 1 culture image (my own Genoa photos also work).
- Generate with an image model that accepts reference images for consistency. Export WebP, and store `alt` text in the JSON.
- Grammar rule images are **components** (`rule` blocks), not generated pictures.
- During development, a placeholder generator (solid colour + caption) keeps the slice unblocked.

### 11.3 Scene player
It replaces DW's video player. It shows the poster with ▶ and the duration, then crossfades between panels at each panel's `from_line` as the audio plays. Subtitles: off / IT / IT + EN. Controls: play/pause, previous/next line, speed 0.75× / 1×, scrubber.

**Fallback mode** (no MP3s, `speechSynthesis` speaks each line in turn):
- The scrubber becomes line-based ("riga 4 di 11"), with previous/next line buttons; there is no continuous seek.
- The duration is estimated from text length and shown with a tilde (*~01:00*).
- Panels switch when the line named in `from_line` starts speaking.
- 0.75× sets the voice's speaking rate.

Once real MP3s exist, the player switches to a true timeline automatically.

---

## 12. Non-functional requirements
- A lesson step renders in under 300 ms locally. Progress writes are optimistic with background sync.
- It works in current Chrome, Edge and Firefox on Windows and macOS. A work laptop may block the microphone or Neon, so recording and sync must fail gracefully, and the app stays usable.
- The app runs with no TTS/image API keys present.
- CI on every PR: lint, typecheck, Vitest, `content:check`. None of these need a database. Playwright runs **locally only**, against the Neon `dev` branch, so no DB secret lives in GitHub.
- No analytics or telemetry.

---

## 13. Original issue breakdown (reference)
M1 is tracked as GitHub issues, which supersede this list. It is kept as a checklist for later milestones.
1. Scaffold: Next.js + TS + Tailwind + ESLint + Vitest + GitHub Actions.
2. Neon + Drizzle: schema from §10, migrations, `.env.example`, a seed profile.
3. Content: Zod schema (§9.1), loader, `content:check`, the example lesson (§9.2) with placeholder media.
4. App chrome: top bar, lesson bar, lesson menu drawer, breadcrumb, footer sync indicator.
5. Level overview: banner, unit groups, lesson cards, status circles, Reset.
6. Lesson intro page + scene player.
7. Step page shell: counter, title, instruction, collapsible Script, notes, footer counter, Next.
8. Item engine: state machine, Check/Solve, scoring, persistence, error_log writes.
9. `single_choice` / `image_choice` / `audio_choice`.
10. `multi_select` (incl. word sets).
11. `dropdown`.
12. `text_gap` + character helper + accent hint.
13. `word_order`.
14. `word_bank`.
15. `audio_gap`.
16. `reading`.
17. `speak_rate` (+ optional recording).
18. `parla`.
19. Results screen + Correct my mistakes.
20. Grammar pages (text, example, table, rule, terms).
21. Vocabulary page.
22. Culture page, Script page, Finish screen, next-lesson navigation.
23. Review hub v1 + review_card scheduling + manual corrections.
24. Offline write queue.
25. `content:audio` TTS script.
26. Playwright e2e: complete the example lesson.

---

## 14. Milestones

### 14.1 First milestone: vertical slice (done)
**Goal:** play one complete lesson (`a2.u01.l01` from §9.2) from the level overview to the Finish screen on computer A, then open computer B and see the same progress.

**In scope**
- Home page with three level cards (B1 and B2 disabled, *In arrivo*) and *Continua da dove eri*.
- Level overview for Ripasso A2: all 10 units from the course plan; unit 1 shows this real lesson card, units 2–10 show one *In arrivo* card each.
- Intro page with the scene player. Placeholder images; audio through the `speechSynthesis` fallback (§11).
- All six steps, with the item types they use: `single_choice`, `multi_select`, `dropdown`, `text_gap` (incl. character helper and accent hint), `word_order` (click to place), `speak_rate`, `parla`. Full Controlla / Soluzione / red-green / disabling / scoring behaviour and the live footer counter.
- EN toggle for instructions; collapsible Copione on steps; Copione page from the lesson menu.
- Results screen (%, steps, Correggi i miei errori, Continua), 2 grammar pages (incl. a `rule` block with a down arrow), the vocabulary page, the culture page, the ‹ › review sequence, and the Finish screen.
- Lesson menu incl. Azzera gli esercizi; level Azzera.
- Neon persistence for `lesson_progress`, `item_state`, `exercise_attempt` and `error_log`, with the in-memory retry and *Offline: non salvato* indicator.
- All UI text in Italian from `ui-it.ts`.
- CI with lint, typecheck, Vitest (answer comparison, scoring) and `content:check`; one local Playwright happy path.

**Out of scope for M1:** `image_choice`, `reading`, `audio_choice`, `word_bank`, `audio_gap`, `clip` media, `word_order` lines layout and drag-reorder, vocab-link popovers, the Feedback textarea, a Settings page, the Review hub and Ripasso personale step, the IndexedDB offline queue, recordings, real illustrations and audio, any further content.

**Done when:** I finish the lesson and see the correct %, then close the browser, run the app on my other computer, and the level overview shows the lesson as completed with the same %. Reopening a step there shows my locked green/red answers.

### 14.2 Second milestone: the rest of unit A2.1 and spaced review
Decided in the M2 grilling (section 17) and tracked as GitHub issues #36–#55, which supersede the list below where they differ.

**Goal:** play all three lessons of A2.1, with every exercise type working, and review my own mistakes in the Review hub and in a Ripasso personale step.

**In scope, in build order**
1. **M1 follow-ups:** the unverified Azzera focus return, plus anything the two-computer check (#19) finds.
2. **Lesson 2 draft:** *La casa della signora Pina*. Pina shows Adam the flat in the caruggi. Grammar: indefinite articles *un / uno / una / un'* and tricky gender (*il problema*, *la mano*, *-e* nouns such as *la chiave*, *il bicchiere*). Vocab: rooms and household objects. Culture: Genoese stairs and *ardesia* slate roofs. An agent writes it as `draft` with placeholder media, following the §5.2 recipe and using the new types. Items of types not built yet show a plain placeholder until their issue lands.
3. **The remaining types and layouts:** `image_choice`, step `reading`, `audio_choice` (with `clip`), `word_bank`, `audio_gap`, `clip` step media, and `word_order` lines.
4. **The IndexedDB queue** (§8), before the review system adds its writes.
5. **Review cards:** `review_card`, `review_log`, the SM-2 scheduler, card creation and the backfill (10.5).
6. **Review hub v1:** review sessions, vocab and error cards, top error tags with tag drills, *Aggiungi una correzione*.
7. **Ripasso personale step.**
8. **Vocab links** (4.3), including links added to lesson 1.
9. **Settings** (`/impostazioni`, 10.1) and **Feedback** (10.6).
10. **Lesson 2 review** (me): play it, comment, flip it to `ready`.
11. **Lesson 3 draft:** *Il vicino di casa*. Adam meets Luca, a young neighbour who uses *tu* at once, in contrast to Pina's *Lei*. Grammar: *tu* vs *Lei*, introducing yourself (*mi chiamo*, *sono di*, *lavoro come*). It is the lesson that teaches `register.lei`. Culture: when Italians switch from *Lei* to *tu*. It is drafted after the lesson 2 review, so that feedback improves it. Then I review it too.

**Out of scope for M2:** recordings (M3), `word_order` drag-reorder (dropped), the TTS script and real illustrations (M3), the vocab trainer (M4), per-item feedback buttons.

**Done when:** all three A2.1 lessons are `ready` and playable to the Finish screen; a wrong answer in one lesson comes back the next day in the Review hub and as a Ripasso personale item in another lesson; and a reload while offline keeps my unsent answers.

### 14.3 Later milestones (suggested)
- M3: the asset pipeline (TTS script, style guide, real illustrations), recordings, Ripasso A2 units 2–10.
- M4: B1 units 1–4; vocab trainer; placement test.

---

## 15. Later / optional features
- **Speech recognition + AI correction for *Parla!***: record → speech-to-text (Whisper, or the browser's Web Speech API) → an LLM returns "what you said / corrected version", an English explanation per fix, and error tags → shown side by side and written to `error_log` (source `ai`). This mirrors how corrections work on our voice calls today. The API key stays server-side.
- **Placement test** (DW has one, `[02]`): about 30 mixed items that recommend which Ripasso A2 units to skip.
- **Final test** per level.
- **Vocab trainer**: a flashcard UI over `review_card` (IT→EN; EN→IT with the article required; listening).
- **Personal glossary**: English words I fell back on during *Parla!* become vocab cards.
- Dark mode; a keyboard-only drill mode.

---

## 16. Decision log (grilling, 2026-11-15)
The decisions below are already applied in the sections they reference.

**Scoring and progress**
1. Each `speak_rate` exchange is its own exercise in "X of Y", as on DW `[10]`. Self-rated exercises never count in points or the % (6.1, ADR-0002).
2. A correct retry after a wrong Check earns no points; it is stored as an attempt (5.1).
3. An accent-only miss scores 0, with the hint and no review card (5.1).
4. Lesson % = points ÷ scorable items, rounded half up; DW's exact rule can't be reproduced (6.1).
5. Level % uses the planned lesson count from the course plan (6.1).
6. *Correggi i miei errori* resets only scorable items and keeps `first_check_correct` (4.4).
7. A stale exercise is detected by content hash and resets on its own (10.3).

**Lesson flow and content**
8. The Step 1 scene never locks its questions; the first item is the course plan's gist question (5.2.13).
9. The DW lesson order wins over the course plan's "Anatomy of a lesson"; Parla! stays the last exercise step.
10. *Hai capito?* types reuse `single_choice`, `dropdown` and `word_order` (lines layout, M2) (5.2.13).
11. Lessons are drafted as JSON by an AI and reviewed by me; `status: "draft"` shows a *Bozza* badge, with no hidden route (3.3, 9.1).
12. The course plan (`docs/course-plan.md`) is the source for units, story beats and error tags. The 14 tags in 10.4 each link to the unit that teaches them; tags whose unit doesn't exist yet show no link. *Amended after #4:* `spelling.accent` and `speaking` have no teaching unit for now, so they never show a link; `register.lei` is taught in A2.1 (`a2.u01`).
13. The course plan's own open questions (protagonist, employer, time budget, work-topic order) are parked as content decisions.

**Language and UI**
14. Language rule: teaching text and translations in English, everything else in Italian (6.3, ADR-0003). Optional `instruction_en` behind an EN toggle replaces the "Instructions in Italian" setting. The `md` fields of grammar `text` blocks and the culture page are English by convention, without an `_en` suffix (ADR-0003).
15. Name *La strada di Adam*; logo = Lanterna SVG + wordmark (3.1).
16. Layout follows the screenshots: sticky bars, breadcrumb on intro and steps only, one ‹ › review sequence, terms panel at the bottom, full-width `text_gap` layout, no word-sets grid (3.1, 4, 5.2).
17. Grammar rule images are general `rule` blocks (4.5, 9.1). Steps can carry a `clip` media kind (M2). Notes can attach to an exchange. Vocab gets `sort_key`, and `forms` is free text (4.6, 9.1).

**Audio**
18. Standard Italian TTS only; Genoese colour goes in the text (11.1).
19. Until MP3s exist, `speechSynthesis` is the fallback, and the scene player works line by line (11.1, 11.3).

**Tech and infrastructure**
20. Next.js + Drizzle + Neon HTTP driver (8, ADR-0001).
21. Neon branches `main` (real progress) and `dev` (experiments, Playwright). Fixed profile UUID, no login (8, 10.1).
22. M1 offline behaviour: in-memory retry every 30 s, footer *Offline: non salvato* (8).
23. CI runs lint, typecheck, Vitest and `content:check`; Playwright is local only (12).

**Scope**
24. Moved to M2: vocab-link popovers, the Feedback textarea, the Settings page, `word_order` drag-reorder (14).
25. Ripasso personale is on by default from M2 (10.5).
26. M2+ details (Review hub, recordings, TTS provider, image style guide) get their own grilling after M1. *Amended:* the Review hub was grilled for M2 (section 17); recordings, the TTS provider and the image style guide are grilled with M3.

---

## 17. Decision log (M2 grilling, 2026-11-21)
The decisions below are already applied in the sections they reference.

**Scope and order**
1. M2 keeps all six §14 themes. Recordings move to M3; `word_order` drag-reorder is dropped; a small first issue gathers M1 follow-ups (14.2).
2. Content first: lesson 2 is drafted before the new types, which are then built against it. Unbuilt types show a placeholder in the meantime. The IndexedDB queue comes right after the types, before the review system adds writes (14.2).
3. Lesson 2 is *La casa della signora Pina* (indefinite articles, tricky gender); lesson 3 is *Il vicino di casa* (*tu* vs *Lei*, introducing yourself, teaches `register.lei`) (14.2).
4. Each lesson gets a drafting issue (agent) and a review issue (me, flips it to `ready`). Lesson 3 is drafted after lesson 2's review (14.2).
5. `audio_choice` gets an optional `clip` of scene lines, so 🔊 works with `speechSynthesis` before MP3s exist (5.2.8, 9.1).

**Spaced review**
6. Classic SM-2 as a pure function, with an append-only `review_log` so FSRS can replace it later (10.5, ADR-0004).
7. Reviews are graded automatically where the app can check (correct → *good*, accent-only → *hard*, wrong or Soluzione → *again*); speaking uses *Bene* / *Non tanto bene*; only vocab cards have four buttons. Reviews never touch lesson state or the % (10.5, ADR-0004).
8. Vocab cards are flip cards (English front, Italian back) with four grade buttons (10.5).
9. Error cards come only from error_log rows with both `given` and `expected` (`manual`, later `ai`): wrong version struck through, type the correction (10.5).
10. Review hub v1: sessions of up to 20 mixed cards, top 5 unresolved tags over 30 days with tag drills of up to 10 items, and *Aggiungi una correzione* (10.5).
11. Ripasso personale: up to 3 due item cards from other lessons with overlapping tags (any due item cards if none match); frozen on the first visit in `lesson_progress.review_items`; counted in *X di Y* but not scorable (10.5, ADR-0005).
12. Item cards are created or reset by a wrong first Check, *Non tanto bene*, or Soluzione before any Check; never by accent-only misses. An error_log row is resolved after 3 non-*again* grades in a row on its card, and top tags count only unresolved rows (10.4, 10.5).

**Sync, links, settings, feedback**
13. The IndexedDB queue stores writes before sending, overlays them on the server state at load, flushes from one tab (Web Locks), says *Offline: salvato su questo computer*, and falls back to the in-memory queue without IndexedDB (§8).
14. Vocab links point only into the same lesson's vocab, never sit in options, tiles or answers, and are ignored by the content hash, so adding them to lesson 1 keeps its progress (4.3, 10.3, ADR-0006).
15. Settings: Ripasso personale on/off, default subtitles and default speed are synced; the `speechSynthesis` voice is per computer. "Instruction language" is gone for good (10.1, ADR-0003).
16. Feedback: the level overview textarea, *Segnala un problema* in the lesson menu (records the current page), a `/feedback` list with *Fatto*, and `npm run feedback:list` for agents (10.6).

---

## Appendix A. Screenshot index (Nicos Weg reference, layout only)

| # | File | Shows |
|---|---|---|
| 01 | 01-a2-course-overview.png | Level overview: banner, Reset, unit groups, lesson cards, status circles |
| 02 | 02-basic-users-overview.png | Level-group landing page with placement test |
| 03 | 03-a1-course-overview.png | Same as 01, for A1 |
| 04 | 04-a1-lesson-introduction.png | Lesson bar, breadcrumb, poster with play + duration |
| 05 | 05-a1-exercise-video-mc.png | Step 1: video + dropdown questions |
| 06 | 06-a1-script-expanded.png | Collapsible Script opened |
| 07 | 07-a1-exercise-incorrect-feedback.png | Dropdown wrong (red), footer "1 out of 3 … 0 points" |
| 08 | 08-a1-exercise-correct-feedback.png | Dropdown correct (green), disabled |
| 09 | 09-a1-exercise-fill-in.png | Typed gaps, image + prompt bubble, special-character icon, Info |
| 10 | 10-a1-audio-self-assessment.png | speak_rate: exchanges, Good / Not so great |
| 11 | 11-a1-formal-select-exercise.png | Dropdown with ordered shared options + Info |
| 12 | 12-a1-audio-introduction-practice.png | speak_rate read-along |
| 13 | 13-a1-own-name-audio-practice.png | speak_rate personal |
| 14 | 14-a1-listening-multiple-choice.png | audio_choice |
| 15 | 15-a1-multi-select-exercise.png | multi_select "two correct answers", Careful / New words notes |
| 16 | 16-a1-word-order-exercise.png | word_order, untouched |
| 17 | 17-a1-word-order-feedback.png | word_order green/red boxes, disabled buttons, "3 out of 3 … 2 points" |
| 18 | 18-a1-lesson-results.png | Results panel 87%, 9/9, guest buttons |
| 19 | 19-a1-grammar-ich-du.png | Grammar: illustrated examples, form rows, arrow rule |
| 20 | 20-a1-grammar-sie.png | Grammar page 2 |
| 21 | 21-a1-vocabulary-list.png | Striped vocab list, audio icons, verb forms |
| 22 | 22-a1-culture-page.png | Culture page |
| 23 | 23-a1-lesson-navigation-drawer.png | Lesson menu |
| 24 | 24-a1-full-script.png | Script page |
| 25 | 25-a2-lesson-introduction.png | A2 lesson intro |
| 26 | 26-a2-video-multi-select.png | Video + multi_select |
| 27 | 27-a2-first-exercise-feedback.png | multi_select feedback |
| 28 | 28-a2-image-mood-choice.png | image_choice with intro text |
| 29 | 29-a2-word-order-subordinate-clauses.png | word_order with sentence-start prompts + Info |
| 30 | 30-a2-subordinate-clause-fill-in.png | Sentence-combining typed gaps |
| 31 | 31-a2-audio-gap-fill-todo.png | audio_gap: mini player + to-do document |
| 32 | 32-a2-script-expanded.png | Script open on an A2 step |
| 33 | 33-a2-bank-brochure-quiz.png | reading: brochure + questions |
| 34 | 34-a2-quiz-feedback.png | Immediate green/red single_choice feedback |
| 35 | 35-a2-money-words.png | multi_select word sets |
| 36 | 36-a2-listening-radio-options.png | audio_choice reason completions |
| 37 | 37-a2-audio-feedback.png | audio_choice feedback + New words |
| 38 | 38-a2-wordbank-fill-in.png | word_bank |
| 39 | 39-a2-audio-comprehension.png | Audio comprehension questions |
| 40 | 40-a2-own-money-audio-practice.png | speak_rate personal prompts |
| 41 | 41-a2-lesson-results.png | Results 79%, 11/11 |
| 42 | 42-a2-grammar-subordinate-clauses.png | Grammar: rule image + explanation |
| 43 | 43-a2-grammar-clause-order.png | Grammar page 2 |
| 44 | 44-a2-vocabulary-list.png | Vocab with forms + images, "Finish the lesson!" |
| 45 | 45-a2-full-script.png | A2 Script page |
| 46 | 46-a2-finish-page.png | Finish screen |
| 47 | 47-a1-finish-page.png | Finish screen (A1) |

*The screenshots are DW's copyrighted material, kept only as a private layout reference. Don't ship them in the app or reuse them as assets.*
