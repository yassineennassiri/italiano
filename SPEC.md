# La strada di Adam: product and UX spec

A personal Italian course web app that copies the **structure and flow** of DW's *Nicos Weg* German course, filled with original Italian content.

> **How to use this document.** Feed it to Claude Code together with the course plan ("Il mio percorso: draft course plan"). Run `grill-me` on it first, then `write-a-prd`, then `to-issues`. Section 14 is the first milestone. Screenshots of the original are in `./screenshots/` and are referenced by number, e.g. `[04]` = `screenshots/04-a1-lesson-introduction.png` (full index in Appendix A).

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
2. **Personal content.** The story follows Adam, an engineer who moves to Genoa to work at *Energetica Ligure*. Levels are Ripasso A2, then B1, then B2. Grammar is explained in English, and nouns always appear with their article.
3. **Speaking first.** Every lesson ends with a *Parla!* speaking task. Self-rating (Good / Not so great) is the baseline.
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

| Term | Meaning |
|---|---|
| Level | Ripasso A2, B1, B2. Equivalent to DW's A1 / A2 / B1 pages. |
| Unit | A themed chapter, e.g. "A2.1 Arrivo a Genova". Ripasso A2 units have 3 lessons; B1 and B2 units have 4. |
| Lesson | One sitting of about 20–25 min: intro, N exercise steps, results, grammar pages, vocabulary, culture (optional), script, finish. |
| Step | One numbered exercise page inside a lesson ("3 / 9"). Contains one or more **items**. |
| Item | One checkable exercise with its own Solve/Check buttons. The footer counts these as "exercises". |
| Scene | Replaces DW's video: a poster image plus a sequence of illustrated panels synced to dialogue audio. |
| Self-rating | "Good" / "Not so great" buttons on speaking items. |

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
```

URLs use stable slugs from the content files. Deep links and the browser Back button work. The last visited step is restored when I reopen a lesson.

### 3.1 Global chrome
- **Top bar**: logo on the left, app title in the centre, hamburger on the right (Home, levels, Review hub, Settings). Ref `[03]`.
- **Lesson bar**: a full-width coloured bar under the top bar on every lesson page. It shows the lesson title in the centre and a chevron on the right that opens the **lesson menu**. Ref `[04]`, `[23]`.
- **Lesson menu** (drop-down panel on the right, `[23]`): Information · Exercises · Grammar · Vocabulary · Culture · Script · Other tools (Review hub; vocab trainer later) · Reset exercises · Course overview. Hide entries the lesson doesn't have (e.g. Culture).
- **Breadcrumb**: `Level / Course / Lesson / Step title` above the content. Ref `[04]`, `[07]`.
- **Footer**: minimal (app name, content version, sync status indicator). DW's footer is not copied.

### 3.2 Home
A simple page listing the three levels as large cards (level badge, title, short description, % completed), plus a "Continue where you left off" button that goes to the last lesson/step. It's loosely modelled on `[02]`. The placement test card is a later feature.

### 3.3 Level overview page (`[01]`, `[03]`)
- **Hero banner**: a full-width original illustration with a circular level badge top-left ("A2", "B1", "B2") and the course logo badge on the right.
- Below the banner on the right: a **Reset** button (resets all progress for the level after a confirmation dialog) and the level's overall status circle.
- **Unit groups** in a 3-column grid (1 column on narrow screens). Each column header is the unit number + title ("1 Arrivo a Genova"). The first group can be an intro unit ("Benvenuto!").
- **Lesson cards** under each header:
  - Italian lesson title (bold, link colour), e.g. *Benvenuto a Genova!*
  - Line 1: English topic, e.g. "Arriving and greeting people"
  - Line 2 (optional): grammar label, e.g. "Articles: il, lo, l', la"
  - Top-right **status circle**: empty = not started, half-filled = in progress, filled with a tick = completed. A tooltip shows the state plus the best % ("Completed · 87%").
  - Cards alternate between light background tints, as on DW.
- Below the grid, as on DW: **More lessons** (link to the Review hub), **Final test** (disabled, "coming later") and **Feedback** (a textarea saved to the DB for my own notes about the content).

---

## 4. Lesson flow (end to end)

```
Intro ─Start→ Step 1 … Step N ─Next on last step→ Results ─Continue→ Grammar 1..G → Vocabulary → Culture? → Finish ─Next→ next lesson's Intro
```

### 4.1 Intro / Information page (`[04]`, `[25]`)
- **Scene player** in poster state: a large 16:9 illustration with a round play button bottom-left and the duration ("01:08").
- **Heading**: the English topic ("Arriving in Genoa").
- **Summary**: 2–4 sentences in English about what happens in the story.
- **Learning objectives**: a bulleted "In this lesson you will learn…" list (communicative goal, grammar point, vocab field).
- **Start** button (primary) → Step 1. Playing the scene here is optional, because Step 1 embeds it again.

### 4.2 Exercise step pages (`[05]`–`[17]`, `[26]`–`[40]`)
Layout from top to bottom:
1. Optional **media** at the top: the scene player or a large image (`[05]`, `[14]`, `[15]`).
2. Step counter **"N / M"**, small and centred (`[10]`).
3. **Step title** (H2, English), e.g. "il, lo, l' or la?".
4. **Instruction** (1–2 sentences, English).
5. **Script ⌄** toggle, collapsed by default. Expanding it shows the transcript of the audio/scene used by this step, with speaker labels in caps and vocab words highlighted (`[06]`, `[32]`, `[37]`). It collapses again with **Script ⌃**.
6. Optional **reading text** (a brochure, a to-do list, an email) shown inline, often on a tinted panel (`[31]`, `[33]`).
7. One or more **items**. Each has its own prompt bubble (a speech bubble with an accent border and a tail), its interaction area, optional notes (4.3), then **Solve** (secondary) and **Check** (accent) buttons, centred.
8. **Footer band** (tinted, full width): "X out of Y exercises completed. Z points scored." and a **Next** button, with the "N / M" counter repeated under it (`[07]`, `[17]`).

Rules:
- **Next is always enabled.** Skipping is allowed, and unattempted items simply stay "not completed".
- On the last step, Next goes to **Results**.
- Item state (typed answers, checked/solved status, points) persists immediately (sections 8 and 10), so reloading or switching computers restores it.

### 4.3 Notes inside steps
Small rows with a round icon, placed under an item:
- **Info:** a grammar or usage remark (`[09]`, `[11]`).
- **Tip:** a strategy hint.
- **New words:** a word introduced here, with a short English gloss (`[15]`, `[37]`).
- **Attenzione!:** our addition for my recurring error patterns (e.g. "*l'* before a vowel, never *il*"). It links to the error tag's explanation.

**Vocab links:** words highlighted in prompts, scripts and reading texts (DW underlines them with a dotted line). Hovering or tapping one shows a popover with the word and its article, the English meaning and an audio button. These words come from the lesson's vocabulary list.

### 4.4 Results screen (`[18]`, `[41]`)
- Heading "Results for this lesson".
- An encouraging line chosen by score band (≥80% "Ottimo lavoro!", 50–79% "Buon lavoro, keep going!", <50% "Try the steps again, you can do it.").
- A large slate panel with the **percentage** (big) and "Results for this lesson: S/M", where S = steps whose items are all completed and M = total steps.
- The line "On the next pages you'll find an overview of grammar, vocabulary, culture and society."
- Buttons. These replace DW's guest buttons ("Log in and correct mistakes" / "Continue (without saving)" / "Log in and save"), since we're always saving:
  - **Correct my mistakes**: jumps to the first step with a wrong or unattempted item. Only those items are reset.
  - **Continue** (accent): goes to Grammar 1.

### 4.5 Grammar pages (`[19]`, `[20]`, `[42]`, `[43]`)
- A header strip with "Grammar" and ‹ › arrows between grammar pages (usually 2 per lesson).
- A **vertical illustrated article** in a narrow centred column: an H2 title ("Articoli determinativi: il, lo, l', la"), an illustration with an example sentence from the scene (target form in **bold**, sentence in italics), a compact **form row/table** (e.g. *Singular · masculine · before a vowel · **l'**ombrello*), the rule in English, and optional **rule images** (a sentence with a coloured target word and an arrow, `[19]`, `[42]`). Render rule images as SVG components, not bitmaps.
- An optional **terms panel**, a side box defining metalanguage ("gender", "elision").
- **Next** button at the bottom (accent). On the last grammar page it goes to Vocabulary.

### 4.6 Vocabulary page (`[21]`, `[44]`)
- A header strip with "Vocabulary" and ‹ › arrows.
- A **striped two-column list**: left = speaker icon + Italian term in link colour, right = English meaning.
- **Nouns always with article and plural**: *la valigia, le valigie*; *l'ombrello, gli ombrelli*. A small m/f gender dot is our addition, for my article errors.
- A small grey forms line under verbs: *perdersi*, then *mi perdo, si perde, mi sono perso/a* (present, plus passato prossimo with its auxiliary). Irregular adjectives show their forms too.
- An optional thumbnail image for concrete nouns (`[44]`).
- Sorted alphabetically by headword, ignoring the article.
- Bottom button: **Next** (to Culture), or **Finish the lesson!** when the lesson has no culture page (`[44]`).

### 4.7 Culture page (`[22]`, `[23]`)
A header strip "Culture and society", an H2 title, a large image, and 2–5 paragraphs of English prose with Italian key terms in bold. Bottom button: **Finish the lesson!**

### 4.8 Script page (`[24]`, `[45]`)
Reached from the lesson menu, outside the linear Next flow. It shows the scene player at the top, then "Script" (H2), then the full transcript with **SPEAKER:** above each line and vocab words highlighted. **Our additions:** clicking a line toggles its English translation underneath, and a ▶ icon on each line plays that line's audio.

### 4.9 Finish screen (`[46]`, `[47]`)
Heading "Results for this lesson", the same slate % panel, "On to the next lesson!", and a wide accent **Next** button to the next lesson's intro. On the last lesson of a level it goes to the level overview with a "Level complete" banner. Reaching this screen marks the lesson **completed**.

### 4.10 Reset
- **Reset exercises** (lesson menu): clears this lesson's item states and score after a confirmation dialog. The lesson goes back to not started. The error log and review cards are **kept**, because they are learning history.
- **Reset** (level overview): the same for every lesson in the level.

---

## 5. Exercise type catalogue

### 5.1 Common item behaviour (applies to every checkable type)

| State | UI and scoring |
|---|---|
| **Untouched** | Inputs active; Solve and Check enabled. |
| **Checked, all correct** | Every input turns **green**. Inputs, Solve and Check are disabled (greyed out, see the first two items in `[17]`). Item is *completed*, **+1 point**. |
| **Checked, some wrong** | Correct parts turn **green and lock**. Wrong parts turn **red** and stay editable. Solve and Check stay enabled (`[07]`, the third item in `[17]`, `[34]`). Item is *completed* (attempted), **0 points**. Editing a red input clears its red state. |
| **Re-check after wrong** | Evaluated again. If it's now all correct, everything turns green and locks, but the item **still scores 0**, because points come only from the first Check. The retry is still stored as an attempt. |
| **Solved** | Correct answers are filled in, everything is disabled. Item is *completed*, **0 points**. |
| **Self-rated** | Clicking **Good** or **Not so great** marks the item *completed* and locks the choice (the chosen button is highlighted, the other is dimmed). Scoring: see 6.1. |

Other common rules:
- **One point per item**, no matter how many gaps it has. DW counts points per exercise: `[17]` shows "3 out of 3 exercises completed. 2 points scored."
- **Typed answers**: trim and collapse whitespace; straight `'` and curly `’` apostrophes are equal. Accents matter (*è* ≠ *e*). If the **only** difference is an accent, mark the answer red with the hint "Check the accent". Each gap can list `accept` alternatives. Matching is case-sensitive by default, configurable per gap.
- Every wrong first Check writes **error_log** rows (10.4) with the item's `error_tags`.
- The footer counter updates live.
- Keyboard: Enter in a text gap = Check that item; Tab moves between inputs; option buttons are focusable.
- **Italian character helper**: a keyboard icon next to typed gaps opens a palette (à è é ì ò ù À È) that inserts at the cursor. This replaces DW's special-character icon in `[09]` and `[31]`.
- Feedback must not rely on colour alone: add ✓ / ✗ icons.

### 5.2 Types
The `type` value is the JSON discriminator.

#### 1. `dropdown`: inline select gaps (`[05]`, `[07]`, `[08]`, `[11]`)
- A sentence or dialogue with inline selects showing "…" as the placeholder. Options are per gap, or shared across gaps in a fixed order ("choose the missing words in the right order", `[11]`).
- Optional image on the left, with the text panel on the right (one item per image, `[07]`).
- Each select turns green or red.

#### 2. `text_gap`: typed gap fill (`[09]`, `[30]`)
- A dialogue/text panel with inline text inputs sized to the answer, a character-helper icon, and an optional image + prompt bubble on the left.
- This is the workhorse for articles, pronouns, verb endings and conjugation drills.

#### 3. `word_order`: tile sentence builder (`[16]`, `[17]`, `[29]`)
- Left: an optional prompt bubble (the other speaker's line, or a sentence start like "Nicos Eltern sind wütend, …"). Right: an empty dotted **answer box** with shuffled **tiles** (light pill buttons) below. Tiles can be words, chunks or punctuation.
- Clicking a tile moves it to the end of the answer, where it turns dark. Clicking a placed tile sends it back. Drag-reorder inside the answer is optional.
- Check compares the sequence with the solution (alternatives via `accept`). The answer box border turns **green or red** (`[17]`).
- The shuffle is deterministic (seeded by item id), so the layout is stable across reloads. Never show tiles already in the solved order.

#### 4. `single_choice`: one correct option (`[14]`, `[34]`, `[37]`)
- A prompt bubble on the left (optionally with 🔊), and 2–4 stacked full-width option buttons on the right.
- **Clicking an option checks it immediately**; DW has no Check button here (`[34]`, `[37]`). If correct, the option turns green with a bubble tail, and the other options grey out and disable. If wrong, the option turns red and the others stay active for a retry (0 points from then on).
- Solve is optional per item (`solvable: true`).

#### 5. `multi_select`: N correct options (`[15]`, `[26]`, `[27]`, `[35]`)
- Same layout as single_choice, but the instruction states how many are right ("There are two correct answers for each question"). Options toggle on and off; evaluation happens on **Check**. Correct picks turn green and wrong picks red. Solve marks all correct options green.
- **Word sets** variant (`[35]`): a grid of word chips; select all that fit the category.

#### 6. `image_choice`: pick the description for an image (`[28]`)
- A prompt bubble ("Che cosa succede?") above an image on the left, and 2 option buttons on the right. It behaves like `single_choice`; it's a separate type only for its layout.
- Supports an optional intro paragraph above all items (in `[28]` it introduces the new words).

#### 7. `reading`: reading comprehension (`[33]`, `[34]`)
- The step's `reading` text is rendered as a document (heading, subheads, paragraphs, vocab links). Brochures, emails, contract clauses and meeting minutes suit the story.
- It's followed by N `single_choice` items, one per question.

#### 8. `audio_choice`: listen, then choose (`[14]`, `[36]`, `[37]`, `[39]`)
- The prompt bubble shows a transcript line with "…" where the missing line goes, plus a 🔊 button that plays the clip. Options are on the right, and it behaves like `single_choice`.
- **Reason** variant (`[36]`, `[37]`): the prompt is a sentence start ("Adam è contento, …") and the options are clause completions ("perché …").

#### 9. `word_bank`: fill gaps from given words (`[38]`)
- A text panel with empty gaps, and a **bank of tiles** right-aligned below it. The instruction says "in the right order".
- Clicking a tile fills the **first empty gap**. Clicking a filled gap returns its word to the bank. Banks can contain duplicates (e.g. the same verb twice) and distractors.
- Check and feedback work per gap, as in `text_gap`.

#### 10. `audio_gap`: listen and fill (`[31]`)
- Left: a prompt bubble and a **mini scene player** that plays only a clip of the scene (from/to line ids). Right: a document panel (a to-do list, a form, a note) with typed gaps that behave like `text_gap`.
- Optional Info note.

#### 11. `speak_rate`: audio self-assessment (`[10]`, `[12]`, `[13]`, `[40]`)
- Rows of **exchanges**. Left: an accent-bordered bubble with the other character's line and 🔊. Right: a tinted bubble with my expected reply, which can contain placeholders ("Mi chiamo … E Lei?") for my own details.
- After each exchange, a "How did you do?" bubble sits on the left, with two stacked buttons **Good** / **Not so great** on the right (`[10]`).
- Variants: **dialogue** (`[10]`), **read_along** (`[12]`: both sides given, I read mine aloud), **personal** (`[13]`, `[40]`: a question on the left and a hint/example on the right; I answer freely).
- **Optional recording (v1 nice-to-have):** a 🎙 button records my answer with MediaRecorder for playback next to the model audio. Recordings are stored only in the browser (IndexedDB), never uploaded.
- **Not so great** writes an error_log row (source `speak_rate`, the item's tags) and creates a review card.

#### 12. `parla`: closing speaking task (our addition, always the last step)
- A bigger open task tied to the scene, written in English with an Italian example answer. Example: "A colleague calls: tell them how your arrival went."
- It shows a checklist of target structures ("use *l'* before a vowel twice"), an optional recording button, and the **Good / Not so great** self-rating.
- An optional free-text box, "What did you hesitate on?". Its content goes to the error log (`source = parla_note`).
- **Future:** speech-to-text plus AI correction (section 15).

#### 13. Scene check: the Step 1 pattern (`[05]`, `[26]`)
This is a step pattern, not a widget: the scene player as top media, followed by `dropdown`, `multi_select` or `single_choice` items about the story. Step 1 of every lesson follows it.

#### Typical lesson recipe (mirrors DW's sequences)
1 scene check → 2 typed/dropdown grammar discovery from the dialogue (with Info) → 3 dialogue `speak_rate` → 4 grammar `dropdown`/`text_gap` → 5 `audio_choice` or `audio_gap` → 6 `reading` or `image_choice` → 7 `multi_select` / `word_bank` → 8 `word_order` → 9 personal `speak_rate` → last: `parla`. That's 8–11 steps in total.

---

## 6. Scoring and progress model

### 6.1 Definitions
- **Item completed**: checked at least once (right or wrong), solved, or self-rated.
- **Item points**: 1 if the first Check was fully correct, otherwise 0. Solved = 0.
- **Self-rated items** (`speak_rate`, `parla`): they count as completed in "X out of Y". **Recommendation:** leave them out of the points total and the % denominator, because they are not objectively scored. DW's exact rule wasn't observed; raise it in `grill-me`.
- **Step completed**: every item in the step is completed.
- **Lesson %** = round(100 × points ÷ number of scorable items). `[18]` shows 87% with 9/9 steps completed, and `[41]` shows 79% with 11/11.
- **Lesson status**: `not_started` (nothing touched), `in_progress`, `completed` (Finish screen reached). Store both `last_percent` and `best_percent`.
- **Level %** = completed lessons ÷ lessons in the level.

### 6.2 Exact footer text
`{completed} out of {total} exercises completed. {points} points scored.`

### 6.3 Language of the UI
All chrome, step titles, instructions, grammar and culture text are in **English**. Prompts, dialogues, options, reading texts and vocab are in **Italian**, as on DW. A setting, "Instructions in Italian", uses `instruction_it` when the content provides it (planned from B1).

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
  A2 / Course / Benvenuto a Genova! / il, lo, l' or la?
                           2 / 6
  il, lo, l' or la?
  Choose the right definite article.
  Script ⌄
  ┌prompt bubble──────┐      ┌text panel────────────────┐
  │ Che cosa ha Adam? │      │ [… ▾] valigia, [… ▾] …   │
  └───────────────────┘      └──────────────────────────┘
   ⓘ Attenzione! Before a vowel, il and la become l'.
                    [Solve] [Check]
░░░░░░  0 out of 1 exercises completed. 0 points scored.  ░░░░
░░░░░░                    [Next]                          ░░░░
                           2 / 6
```

**Results / Finish** (`[18]`, `[46]`): heading, encouragement line, a slate panel with "87%" and "Results for this lesson: 9/9", then the buttons.

### 7.1 Visual design
- Keep DW's **layout grammar**: a narrow centred column (~720 px) for exercises, wide media (~960 px), a tinted full-width footer band, speech-bubble prompts with a tail, light-tinted pill option buttons, an accent colour for Check/Next/Finish, and a dark link colour for titles.
- Use **our own palette, type and logo**. Suggestion: Ligurian blue `#0B4F8A` (links, lesson bar on a lighter `#3D8BD9`), focaccia yellow `#F6C94C` (accent buttons and bubble borders), slate `#5B6670` (results panel), green `#3BB273` / red `#E5484D` (feedback).
- All interactions must work with the keyboard and show visible focus.

---

## 8. Recommended tech stack (recommendation, not mandate)

**Recommended: Next.js (App Router) + TypeScript**, run locally with `npm run dev`.
- One process gives both the UI and a small server-side API (Route Handlers or Server Actions). That matters because the **Neon connection string must stay on the server**, never in the browser.
- File-based routes map 1:1 onto `/:level/:lesson/esercizi/:n`.
- Lesson JSON is read from disk on the server, with no CMS needed.

Supporting pieces:
- **Drizzle ORM** + `@neondatabase/serverless` for Neon, with SQL migrations in the repo.
- **Zod** for the content schema, plus `npm run content:check` (also run in GitHub Actions) to validate every lesson file, check ID uniqueness, and check that every referenced media file exists.
- **Tailwind CSS** + a few headless primitives (dialog, popover, drawer).
- **Vitest** for answer comparison and scoring; **Playwright** for one end-to-end lesson.

Equally valid alternative: **Vite + React** SPA plus a tiny **Hono** API server. It's lighter and has less framework magic, but means two processes (or a dev proxy) and hand-rolled routing.

Per-computer setup: `git clone` → `npm i` → copy `.env.example` to `.env.local` and set `DATABASE_URL` (Neon) → `npm run db:migrate` (once) → `npm run dev`. Never commit `.env*`.

**Sync resilience:** progress writes are optimistic and go through a small client queue. If Neon is unreachable (e.g. a locked-down work network), writes wait in IndexedDB and retry, and a footer indicator shows "Synced / Pending / Offline". Conflict rule per item: the earliest `first_check_correct` wins, and the latest state wins for everything else.

---

## 9. Content model and file layout

```
content/
  course.json                      # levels → units → lesson ids, in order
  characters.json                  # names, TTS voice ids, illustration style notes
  error-tags.json                  # tag → English explanation + link to grammar page
  levels/a2/units/01-arrivo-a-genova/
      unit.json                    # unit number, title, description
      lessons/01-benvenuto-a-genova.json
  media/
    images/a2/u01/l01/poster.webp, panel-01.webp, …
    audio/a2/u01/l01/<hash>.mp3    # generated, see §11
```

IDs are stable and hierarchical: lesson `a2.u01.l01`, step `a2.u01.l01.s03`, item `a2.u01.l01.s03.i02`, gap `g1`. **Never change an ID once progress exists.** When content changes, bump the lesson's `version`; progress rows store the version they were made against.

### 9.1 Lesson file schema (TypeScript notation; implement with Zod)

```ts
type Lesson = {
  id: string;                 // "a2.u01.l01"
  version: number;
  slug: string;               // "benvenuto-a-genova"
  title: string;              // Italian title (card + lesson bar)
  topic_en: string;           // card line 1 / intro heading
  grammar_label?: string;     // card line 2
  summary_en: string;
  objectives_en: string[];
  scene: Scene;
  steps: Step[];
  grammar: GrammarPage[];
  vocab: VocabEntry[];
  culture?: CulturePage;
};

type Scene = {
  poster: string;             // path under content/media
  duration_s: number;
  panels: { image: string; from_line: string }[];   // panel shown from this line id onward
  lines: ScriptLine[];
};
type ScriptLine = { id: string; speaker: string; it: string; en: string; audio?: string };

type Step = {
  id: string;
  title_en: string;
  instruction_en: string;
  instruction_it?: string;
  media?: { kind: "scene" } | { kind: "image"; src: string; alt: string };
  script?: "scene" | ScriptLine[];          // what the collapsible Script shows
  reading?: string;                          // markdown document (reading steps)
  items: Item[];
};

type Note = { kind: "info" | "tip" | "new_words" | "attenzione"; text_en: string; error_tag?: string };

type ItemBase = {
  id: string; prompt?: string; prompt_audio?: string; image?: string;
  notes?: Note[]; error_tags?: string[]; solvable?: boolean;
};

type Gap = { id: string; answer: string; accept?: string[]; case_sensitive?: boolean };

type Item = ItemBase & (
  | { type: "dropdown";  text: string; gaps: (Gap & { options: string[] })[] }   // text uses {{g1}} markers
  | { type: "text_gap";  text: string; gaps: Gap[] }
  | { type: "word_bank"; text: string; bank: string[]; gaps: Gap[] }
  | { type: "audio_gap"; clip: { from_line: string; to_line: string }; text: string; gaps: Gap[] }
  | { type: "word_order"; tiles: string[] /* correct order; the app shuffles */; accept?: string[][] }
  | { type: "single_choice" | "image_choice" | "audio_choice"; options: string[]; answer: number }
  | { type: "multi_select"; options: string[]; answers: number[] }
  | { type: "speak_rate"; variant: "dialogue" | "read_along" | "personal";
      exchanges: { other: string; other_audio?: string; me: string; me_audio?: string; hint_en?: string }[] }
  | { type: "parla"; task_en: string; example_it: string; checklist_en: string[] }
);

type GrammarPage = { id: string; title: string; blocks: GrammarBlock[] };
type GrammarBlock =
  | { kind: "text"; md: string }
  | { kind: "example"; image?: string; it: string /* **bold** = target form */; en?: string }
  | { kind: "table"; columns: string[]; rows: string[][] }
  | { kind: "arrow_rule"; before: string; after: string; highlight: string }   // rendered as SVG
  | { kind: "terms"; items: { term: string; def_en: string }[] };

type VocabEntry = {
  id: string; it: string /* "la valigia" */; plural?: string; gender?: "m" | "f";
  pos: "noun" | "verb" | "adj" | "adv" | "phrase" | "other";
  forms?: string; en: string; image?: string; audio?: string;
};

type CulturePage = { title: string; image: string; md: string };
```

- `{{g1}}` marks a gap inside `text`; `\n` is a line break; `**SPEAKER:**` prefixes are allowed in dialogue texts.
- Vocab links: any `[[word|v-id]]` in prompts, readings or script lines renders as a highlighted vocab link.
- `audio` / `*_audio` fields are filled in by the audio script (§11), never by hand. Omit them while drafting.
- Validation rules: every `answer` must be one of `options` for dropdowns, every gap marker must have a gap entry, `answers` indexes must be in range, and the last step must contain a `parla` item.

### 9.2 Example lesson: Ripasso A2, Unit 1 "Arrivo a Genova", Lesson 1

Story beat from the course plan: Adam arrives at Genova Piazza Principe and meets his landlady, Signora Pina. Grammar: definite articles *il / lo / l' / la · i / gli / le*. It's shortened to 6 steps here; real lessons have 8–11.

```json
{
  "id": "a2.u01.l01",
  "version": 1,
  "slug": "benvenuto-a-genova",
  "title": "Benvenuto a Genova!",
  "topic_en": "Arriving and greeting people",
  "grammar_label": "Articles: il, lo, l', la · i, gli, le",
  "summary_en": "Adam gets off the train at Genova Piazza Principe. His landlady, Signora Pina, is waiting on the platform. She is curious, talks fast and has opinions about his luggage.",
  "objectives_en": [
    "Greet someone formally and introduce yourself",
    "Choose the right definite article: il, lo, l', la",
    "Form the plural articles: i, gli, le",
    "Name your travel things: la valigia, lo zaino, l'ombrello"
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
      "title_en": "Arriving in Genoa",
      "instruction_en": "Watch the scene and answer the questions.",
      "media": { "kind": "scene" },
      "script": "scene",
      "items": [
        {
          "id": "a2.u01.l01.s01.i01", "type": "single_choice",
          "prompt": "Com'è andato il viaggio di Adam?",
          "options": ["Bene, ma il treno era in ritardo.", "Male: ha perso il treno.", "Benissimo, il treno era in anticipo."],
          "answer": 0
        },
        {
          "id": "a2.u01.l01.s01.i02", "type": "multi_select",
          "prompt": "Che cosa ha Adam con sé? Ci sono tre risposte giuste.",
          "options": ["la valigia", "la bicicletta", "lo zaino", "l'ombrello"],
          "answers": [0, 2, 3],
          "notes": [{ "kind": "new_words", "text_en": "con sé = with him, on him" }]
        }
      ]
    },
    {
      "id": "a2.u01.l01.s02",
      "title_en": "il, lo, l' or la?",
      "instruction_en": "Choose the right definite article.",
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
      "title_en": "One suitcase, two suitcases",
      "instruction_en": "Write the plural article: i, gli or le.",
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
      "title_en": "How was the journey?",
      "instruction_en": "Put the words in the right order to answer Signora Pina.",
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
      "title_en": "Your turn: meeting your landlady",
      "instruction_en": "Listen to Signora Pina, answer aloud and complete with your own details. Then rate yourself.",
      "items": [
        {
          "id": "a2.u01.l01.s05.i01", "type": "speak_rate", "variant": "dialogue",
          "exchanges": [
            { "other": "Buongiorno! Lei è …, vero?", "me": "Sì, sono io. Buongiorno, signora!" },
            { "other": "Com'è andato il viaggio?", "me": "Bene, grazie. Il treno / L'aereo era …" },
            { "other": "Ha tutto?", "me": "Sì: la valigia, lo zaino e …", "hint_en": "Name 2–3 things, always with the article." }
          ],
          "error_tags": ["article.elision", "register.lei"],
          "notes": [{ "kind": "tip", "text_en": "Signora Pina uses Lei (formal). Stay formal too: E Lei?" }]
        }
      ]
    },
    {
      "id": "a2.u01.l01.s06",
      "title_en": "Parla! Your arrival",
      "instruction_en": "Speak freely for about a minute. Record yourself if you like, then rate how it went.",
      "items": [
        {
          "id": "a2.u01.l01.s06.i01", "type": "parla",
          "task_en": "A colleague from Energetica Ligure calls to ask how your arrival in Genoa went. Tell them about the journey, what you brought, and your first impression of the flat and the caruggi.",
          "example_it": "Il viaggio è andato bene, ma il treno era in ritardo. Ho portato la valigia, lo zaino e l'ombrello. L'appartamento è nel centro storico, in un caruggio molto stretto…",
          "checklist_en": ["Use l' before a vowel at least twice", "Use one plural with gli", "Use era once"],
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
        { "kind": "arrow_rule", "before": "lo straniero", "after": "gli stranieri", "highlight": "gli" },
        { "kind": "text", "md": "**lo** and masculine **l'** both become **gli**. Feminine **l'** becomes **le**, with no apostrophe." }
      ]
    }
  ],
  "vocab": [
    { "id": "v-appartamento", "it": "l'appartamento", "plural": "gli appartamenti", "gender": "m", "pos": "noun", "en": "flat, apartment" },
    { "id": "v-caruggio", "it": "il caruggio", "plural": "i caruggi", "gender": "m", "pos": "noun", "forms": "Genoese word", "en": "narrow alley in Genoa's old town" },
    { "id": "v-ombrello", "it": "l'ombrello", "plural": "gli ombrelli", "gender": "m", "pos": "noun", "en": "umbrella" },
    { "id": "v-perdersi", "it": "perdersi", "pos": "verb", "forms": "mi perdo, si perde, mi sono perso/a", "en": "to get lost" },
    { "id": "v-ritardo", "it": "in ritardo", "pos": "phrase", "en": "late, delayed" },
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
| id | uuid PK | one row |
| display_name | text | |
| settings | jsonb | instruction language, audio speed, recording on/off, subtitles |
| created_at | timestamptz | |

### 10.2 `lesson_progress`
| column | type | notes |
|---|---|---|
| user_id | uuid FK | |
| lesson_id | text | `a2.u01.l01` |
| content_version | int | |
| status | text | `not_started` · `in_progress` · `completed` |
| last_location | text | resume point, e.g. `esercizi/3` |
| last_percent | int | |
| best_percent | int | |
| started_at, completed_at, updated_at | timestamptz | |
| PK | (user_id, lesson_id) | |

### 10.3 `item_state` (current state) and `exercise_attempt` (history)
**`item_state`**: `user_id`, `item_id`, `lesson_id`, `status` (`untouched` · `checked_correct` · `checked_wrong` · `solved` · `rated_good` · `rated_not_great`), `first_check_correct` bool, `points` smallint (0/1), `answer` jsonb (current inputs, to restore the UI), `updated_at`. PK (user_id, item_id). Reset deletes these rows for the lesson.

**`exercise_attempt`** (append-only, never reset): `id`, `user_id`, `item_id`, `lesson_id`, `content_version`, `action` (`check` · `solve` · `rate` · `reset`), `answer` jsonb, `result` jsonb (per-gap correct/incorrect), `correct` bool, `created_at`.

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
| resolved | bool | set after 3 successful reviews in a row |
| created_at | timestamptz | |

The initial tags (in `content/error-tags.json`, each with an English explanation and a link to its grammar page) come from the course plan's "weak points" table: `article.elision`, `article.lo`, `article.plural_gli`, `partitive.masc_plural`, `gender.anglicism`, `prep.articulated`, `agreement.plural`, `congiuntivo.volere_che`, `lexis.invented_word`, `lexis.english_fallback`, `register.lei`, `verb.conjugation`, `spelling.accent`, `speaking`.

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
| UNIQUE | (user_id, kind, ref_id) | |

Rules:
- Finishing a lesson creates `vocab` cards for its vocab list.
- A wrong first Check or a **Not so great** rating creates (or resets) an `item` card for that item, due tomorrow.
- Accent-only misses are logged but don't create cards.
- **Review hub** (`/ripasso`): "Due today" (vocab + items + errors, mixed, in the same item UI), "My top error tags" (counts over the last 30 days; clicking a tag starts a drill of items with that tag from completed lessons), and "Add a correction" (manual entries).
- **Ripasso step (optional, per lesson):** if `settings.inject_review` is on, the app inserts an extra "Ripasso personale" step before *Parla!* with 2–3 due item cards whose tags match the lesson. This implements the course plan's "plus 2–3 items drawn from your own error log".

### 10.6 `feedback_note`
`id`, `user_id`, `scope` (`level` · `lesson` · `item`), `ref_id`, `text`, `created_at`, `done` bool. These are my notes about content to fix.

---

## 11. Audio and image assets (recommendations)

### 11.1 Audio: TTS generated when authoring, committed as files
- `npm run content:audio` walks every lesson file. For each script line, prompt with audio, speak_rate exchange and vocab entry it computes `hash(text + voice + speed)`. If `media/audio/<level>/<unit>/<lesson>/<hash>.mp3` is missing, it calls the TTS provider and saves the file, then writes the path into a sidecar `audio-map.json` (so lesson JSON stays hand-editable). It's idempotent: only changed lines regenerate.
- Providers (pick one): **Azure Speech** or **Google Cloud TTS** (good Italian neural voices, cheap, SSML for pauses), **ElevenLabs** (most natural, pricier) or **OpenAI TTS**. Each character gets a fixed voice in `characters.json`: Pina older female, Giulia female, Marco fast male, Elena precise female, Adam male, Sofia female with a Spanish touch if available.
- Scene audio = line clips joined with ~400 ms gaps. The script records each line's start time so panels, subtitles and `audio_gap` clips can sync.
- Vocab audio at 0.9× speed.
- TTS API keys live only in `.env.local` and are used only by the script. The running app needs no AI keys.
- Size: 48–64 kbps mono mp3 ≈ 0.5 MB per lesson. Switch `media/**` to **Git LFS** if the repo passes ~1 GB.

### 11.2 Images: generated illustrations with one fixed style
- `content/style-guide.md`: a flat or semi-flat editorial illustration style, a warm Ligurian palette, and **character model sheets** (Adam, Giulia, Marco, Elena, Pina, Luca, Sofia) with fixed faces, hair and clothes, plus reference images for each.
- Per lesson: 1 poster (16:9, 1600 px), 3–6 scene panels, 0–4 item images (800 px), 1–2 grammar example images, 1 culture image (my own Genoa photos also work).
- Generate with an image model that accepts reference images for consistency. Export WebP, and store `alt` text in the JSON.
- Grammar rule images are **components** (`arrow_rule`), not generated pictures.
- During development, a placeholder generator (solid colour + caption) keeps the slice unblocked.

### 11.3 Scene player
It replaces DW's video player. It shows the poster with ▶ and the duration, then crossfades between panels at each panel's `from_line` as the audio plays. Subtitles: off / IT / IT + EN. Controls: play/pause, previous/next line, speed 0.75× / 1×, scrubber.

---

## 12. Non-functional requirements
- A lesson step renders in under 300 ms locally. Progress writes are optimistic with background sync.
- It works in current Chrome, Edge and Firefox on Windows and macOS. A work laptop may block the microphone or Neon, so recording and sync must fail gracefully, and the app stays usable.
- The app runs with no TTS/image API keys present.
- CI on every PR: lint, typecheck, Vitest, `content:check`.
- No analytics or telemetry.

---

## 13. Suggested issue breakdown (input for `to-issues`)
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
20. Grammar pages (text, example, table, arrow_rule, terms).
21. Vocabulary page.
22. Culture page, Script page, Finish screen, next-lesson navigation.
23. Review hub v1 + review_card scheduling + manual corrections.
24. Offline write queue.
25. `content:audio` TTS script.
26. Playwright e2e: complete the example lesson.

---

## 14. First milestone: vertical slice
**Goal:** play one complete lesson (`a2.u01.l01` from §9.2) from the level overview to the Finish screen on computer A, then open computer B and see the same progress.

**In scope**
- Level overview for Ripasso A2 showing unit 1 with this real lesson card. Other lessons appear as disabled "coming soon" stub cards.
- Intro page with the scene player. Placeholder images are fine, and the audio can be TTS or silent with subtitles.
- All six steps, with the item types they use: `single_choice`, `multi_select`, `dropdown`, `text_gap`, `word_order`, `speak_rate`, `parla`. Full Check / Solve / red-green / disabling / scoring behaviour and the live footer counter.
- Collapsible Script on steps; Script page from the lesson menu.
- Results screen (%, steps, Correct my mistakes, Continue), 2 grammar pages, the vocabulary page, the culture page, and the Finish screen.
- Lesson menu incl. Reset exercises; level Reset.
- Neon persistence for `lesson_progress`, `item_state`, `exercise_attempt` and `error_log`.
- CI with `content:check`; Vitest for answer comparison and scoring; one Playwright happy path.

**Out of scope for M1:** `image_choice`, `reading`, `audio_choice`, `word_bank`, `audio_gap`, the Review hub, the offline queue, recordings, real illustrations, any further content.

**Done when:** I finish the lesson and see the correct %, then close the browser, run the app on my other computer, and the level overview shows the lesson as completed with the same %. Reopening a step there shows my locked green/red answers.

**Next milestones (suggested)**
- M2: the remaining exercise types; lessons 2–3 of unit A2.1; Review hub v1.
- M3: the asset pipeline (TTS script, style guide, real illustrations); Ripasso A2 units 2–10.
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

## 16. Open questions for `grill-me`
1. Do self-rated items count toward the lesson %? Recommendation: no (DW's rule wasn't observed).
2. Should a correct retry after a wrong Check earn anything? Recommendation: no points, but log it as an attempt.
3. Must the Step 1 scene be played before its questions unlock? Recommendation: no, as on DW.
4. Is the "Ripasso personale" step injected into lessons by default, or only on request?
5. Authoring workflow: will lessons be drafted in JSON by an AI assistant and reviewed by me? If so, add a `draft: true` flag plus a hidden preview route.
6. App name and logo.
7. Standard Italian TTS only, or a light Genoese colour for Pina and Marco (also open in the course plan)?

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
