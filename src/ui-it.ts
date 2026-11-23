/**
 * Every UI string of the app, in Italian (SPEC §6.3, ADR-0003). Components
 * never hard-code text; ESLint enforces that in src/app and src/components.
 * Content text (titles, topics, descriptions) comes from the content files.
 */

import type { LevelId } from "@/content/ids";
import type { LessonPage, ReviewPage } from "@/content/lesson-nav";
import type { Note, VocabEntry } from "@/content/schema";
import type { SubtitleMode } from "@/audio/subtitles";
import type { Rating } from "@/items/self-rating";
import type { Grade } from "@/review/sm2";
import { type CardKind, cardKinds } from "@/review/kinds";
import type { ScoreBand } from "@/progress/results";
import type { SyncStatus } from "@/progress/write-queue";
import type { LessonStatus } from "@/scoring/lesson";

type NoteKind = Note["kind"];

const appName = "La strada di Adam";

/** A lesson (feminine) in each status. */
const lessonStatusName: Record<LessonStatus, string> = {
  not_started: "Non iniziata",
  in_progress: "In corso",
  completed: "Completata",
};

/** The review pages as the Results screen lists them. */
const reviewPageName: Record<ReviewPage, string> = {
  grammatica: "grammatica",
  vocabolario: "vocabolario",
  cultura: "cultura e società",
};

/** Review cards of each kind a session shows, as its counts name them. */
const cardKindName: Record<CardKind, { one: string; many: string }> = {
  vocab: { one: "parola", many: "parole" },
  item: { one: "esercizio", many: "esercizi" },
  error: { one: "correzione", many: "correzioni" },
};

/** The counts of the kinds that have any, joined: "3 parole e 2 esercizi". */
function kindCounts(counts: Readonly<Record<CardKind, number>>): string {
  const parts = cardKinds.filter((kind) => counts[kind] > 0).map((kind) => ui.review.kindCount(kind, counts[kind]));
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}` : (parts[0] ?? ui.review.kindCount("item", 0));
}

/** A level (masculine) in each status. */
const levelStatusName: Record<LessonStatus, string> = {
  not_started: "Non iniziato",
  in_progress: "In corso",
  completed: "Completato",
};

export const ui = {
  appName,
  appDescription: "Un corso di italiano personale, ambientato a Genova.",
  /** The word next to the Lanterna logo. */
  wordmark: "italiano",

  topBar: {
    homeLink: `${appName}: home`,
    openMenu: "Apri il menu",
    closeMenu: "Chiudi il menu",
    menuTitle: "Menu",
    home: "Home",
    levels: "Livelli",
    review: "Ripasso",
    settings: "Impostazioni",
  },

  footer: {
    contentVersion: (version: string) => `Contenuti ${version}`,
    /** The sync status (SPEC §8). */
    sync: {
      saved: "Salvato",
      pending: "In attesa",
      offline: "Offline: non salvato",
      /** A failed write waits in IndexedDB, so a reload keeps it. */
      stored: "Offline: salvato su questo computer",
    } satisfies Record<SyncStatus, string>,
  },

  comingSoon: "In arrivo",

  /** A percentage: the lesson % on the slate panel, the level % on the overview. */
  percent: (percent: number) => `${percent}%`,

  draft: "Bozza",
  /** The round level badge: "A2", "B1", "B2". */
  levelBadge: (levelId: LevelId) => levelId.toUpperCase(),

  notFound: {
    heading: "Pagina non trovata",
    text: "Questa pagina non esiste, o la lezione non la prevede.",
    home: "Torna alla home",
  },

  home: {
    heading: "Scegli il livello",
    intro: "La storia di Adam, ingegnere appena arrivato a Genova: dal ripasso dell'A2 fino al B2.",
    continue: "Continua da dove eri",
    /** A level card's level %: "3% completato". */
    levelPercent: (percent: number) => `${percent}% completato`,
  },

  level: {
    pageTitle: (levelTitle: string) => `${levelTitle} · ${appName}`,
    /** The level status circle's tooltip, with the level %: "Livello: In corso · 3%". */
    levelStatus: (status: LessonStatus, percent: number) => `Livello: ${levelStatusName[status]} · ${percent}%`,
    /** The banner after the level's last lesson (SPEC §4.9). */
    completed: "Livello completato",
    finalTest: "Test finale",
    /** The link to the review hub below the unit grid (SPEC §3.3). */
    moreLessons: "Altre lezioni",
    moreLessonsText: "Ripassa i tuoi errori",
  },

  /** The Results screen (SPEC §4.4) and the Finish screen (§4.9). */
  results: {
    heading: "Risultati della lezione",
    band: {
      great: "Ottimo lavoro!",
      good: "Buon lavoro, continua così!",
      retry: "Riprova gli esercizi, ce la puoi fare.",
    } satisfies Record<ScoreBand, string>,
    /** S/M on the slate panel: completed steps of all steps. */
    steps: (completed: number, total: number) => `Risultati della lezione: ${completed}/${total}`,
    nextPages: (pages: readonly ReviewPage[]) =>
      `Nelle prossime pagine trovi un riepilogo di: ${pages.map((page) => reviewPageName[page]).join(", ")}.`,
    correct: "Correggi i miei errori",
    continue: "Continua",
    nextLesson: "Avanti con la prossima lezione!",
  },

  lesson: {
    pageTitle: (lessonTitle: string) => `${lessonTitle} · ${appName}`,
    openMenu: "Apri il menu della lezione",
    closeMenu: "Chiudi il menu della lezione",
    menu: {
      info: "Informazioni",
      esercizi: "Esercizi",
      grammatica: "Grammatica",
      vocabolario: "Vocabolario",
      cultura: "Cultura",
      copione: "Copione",
      strumenti: "Altri strumenti",
      corso: "Panoramica del corso",
    } satisfies Record<LessonPage, string>,
    breadcrumb: "Percorso",
    course: "Corso",

    /** The intro page (SPEC §4.1). */
    posterAlt: (lessonTitle: string) => `Scena della lezione: ${lessonTitle}`,
    /** The scene length on the poster: 58 → "00:58". */
    duration: (seconds: number) =>
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.round(seconds % 60)).padStart(2, "0")}`,
    /** An estimated scene length, when speech stands in for the MP3s (SPEC §11.3): "~00:35". */
    estimatedDuration: (seconds: number) => `~${ui.lesson.duration(seconds)}`,
    objectives: "In questa lezione impari a…",

    /** The scene player (SPEC §11.3). */
    player: {
      play: "Riproduci la scena",
      pause: "Metti in pausa",
      previousLine: "Riga precedente",
      nextLine: "Riga successiva",
      /** The line-based scrubber: "riga 4 di 11". */
      lineOf: (line: number, total: number) => `riga ${line} di ${total}`,
      scrubber: "Vai alla riga",
      speed: "Velocità",
      speeds: { normal: "1×", slow: "0,75×" },
      subtitles: "Sottotitoli",
      subtitleModes: { off: "No", it: "IT", it_en: "IT + EN" } satisfies Record<SubtitleMode, string>,
      panelAlt: (panel: number, total: number) => `Scena, immagine ${panel} di ${total}`,
    },
    /** The audio-only clip player at the top of a step, and audio_gap's mini player (SPEC §5.2.8, §9.1). */
    clipPlayer: {
      label: "Ascolta il dialogo",
      noVoice: "Nessuna voce italiana installata: l'audio non è disponibile.",
    },
    /** The 🔊 buttons and the script's ▶ (SPEC §11.1). */
    listen: "Ascolta",
    stopListening: "Ferma l'audio",
    noItalianVoice: "Nessuna voce italiana installata: l'audio non è disponibile. Attiva i sottotitoli.",
    /** A script line toggles its English (SPEC §4.8). */
    showTranslation: "Mostra la traduzione",
    /** SPEAKER: above a script line (SPEC §4.8). */
    speakerLabel: (speaker: string) => `${speaker}:`,
    start: "Inizia",

    /** Step pages (SPEC §4.2). */
    stepCounter: (number: number, total: number) => `${number} / ${total}`,
    english: "EN",
    showEnglish: "Mostra l'istruzione in inglese",
    script: "Copione",
    notes: {
      info: "Info",
      tip: "Consiglio",
      new_words: "Parole nuove",
      attenzione: "Attenzione!",
    } satisfies Record<NoteKind, string>,
    /** After an Attenzione! note: the link to the page that teaches its error tag. */
    noteRule: "Vedi la regola",
    next: "Avanti",
    /** Item controls (SPEC §5.1). */
    solve: "Soluzione",
    check: "Controlla",
    /** A dropdown gap's empty choice (SPEC §5.2.1). */
    gapPlaceholder: "…",
    /** An item's image (left of its text, SPEC §5.2.1); item images carry no alt text of their own. */
    itemImageAlt: "Illustrazione dell'esercizio",
    /** The accessible name of gap N in an item. */
    gapLabel: (number: number) => `Spazio ${number}`,
    /** Beside a red typed gap whose only mistake is an accent (SPEC §5.1). */
    accentHint: "Controlla l'accento",
    /** The keyboard icon that opens the à è é … palette (SPEC §5.1). */
    characterHelper: "Caratteri italiani",
    /** The accessible name of a palette button. */
    insertCharacter: (character: string) => `Inserisci ${character}`,
    /** Self-rating after a speaking exchange or Parla! (SPEC §5.2.11, §5.2.12). */
    rateQuestion: "Com'è andata?",
    rating: { good: "Bene", not_great: "Non tanto bene" } satisfies Record<Rating, string>,
    /** Parla! (SPEC §5.2.12). */
    parlaExample: "Esempio di risposta",
    parlaChecklist: "Obiettivi",
    hesitationNote: "Su cosa hai esitato?",
    hesitationPlaceholder: "Facoltativo: una parola, una struttura, un dubbio…",
    /** A word_order item's answer box and the tiles still to place, as words or as script lines (SPEC §5.2.3). */
    answerBox: "La tua risposta",
    tileTray: "Parole da mettere in ordine",
    lineTray: "Battute da mettere in ordine",
    /** A word_bank item's bank, and a filled gap read out with its word (SPEC §5.2.9). */
    wordBank: "Parole da inserire",
    filledGapLabel: (number: number, word: string) => `Spazio ${number}: ${word}`,
    /** In place of an item whose type has no component yet (M2 lesson drafts). */
    unbuiltItem: "Esercizio non ancora disponibile",
    /** Read out with the ✓ and ✗ icons. */
    correct: "Giusto",
    wrong: "Sbagliato",
    /** The step of up to 3 exercises from the learner's mistakes in other lessons, before Parla! (SPEC §10.5). */
    ripasso: {
      title: "Ripasso personale",
      instruction: "Questi esercizi vengono dai tuoi errori nelle altre lezioni. Non danno punti: servono a ripassare.",
    },
    /** SPEC §6.2; the nouns agree with the total, the points with their count. */
    footerCounter: ({ completed, total, points }: { completed: number; total: number; points: number }) =>
      `${completed} di ${total} ${total === 1 ? "esercizio completato" : "esercizi completati"}. ` +
      `${points} ${points === 1 ? "punto" : "punti"}.`,

    /** The review sequence (SPEC §4): each page's header strip, its ‹ › arrows and its bottom button. */
    grammar: "Grammatica",
    vocabulary: "Vocabolario",
    culture: "Cultura e società",
    previousPage: "Pagina precedente",
    nextPage: "Pagina successiva",
    finishLesson: "Finisci la lezione!",
    /** A grammar example's illustration (SPEC §4.5). */
    exampleImageAlt: "Illustrazione dell'esempio",
    /** A rule image read out as its rows, in order: "lo straniero; gli stranieri". */
    ruleImage: (rows: readonly string[]) => rows.join("; "),
    /** The gender dot on the vocabulary page (SPEC §4.6). */
    gender: { m: "maschile", f: "femminile" } satisfies Record<NonNullable<VocabEntry["gender"]>, string>,
    /** The letter on the gender dot. */
    genderLetter: { m: "m", f: "f" } satisfies Record<NonNullable<VocabEntry["gender"]>, string>,
    /** The gender dot read out after the term: " (maschile)". */
    genderLabel: (gender: NonNullable<VocabEntry["gender"]>) => ` (${ui.lesson.gender[gender]})`,
    /** A noun with its plural (SPEC §4.6): "la valigia, le valigie". */
    nounWithPlural: (singular: string, plural: string) => `${singular}, ${plural}`,
  },

  /** Azzera (SPEC §4.10): the lesson menu's and the level overview's buttons, and their confirmation dialog. */
  reset: {
    lessonButton: "Azzera gli esercizi",
    levelButton: "Azzera",
    lessonQuestion: "Azzerare gli esercizi di questa lezione?",
    levelQuestion: "Azzerare tutto il livello?",
    lessonText: (lessonTitle: string) =>
      `Le risposte e il punteggio di «${lessonTitle}» vengono cancellati e la lezione torna da iniziare.`,
    levelText: (levelTitle: string) =>
      `Le risposte e il punteggio di tutte le lezioni di «${levelTitle}» vengono cancellati e le lezioni tornano da iniziare.`,
    keptText: "Gli errori registrati restano: fanno parte della tua storia di apprendimento.",
    cancel: "Annulla",
    confirm: "Azzera",
  },

  /** The review hub and its review sessions (SPEC §10.5). */
  review: {
    pageTitle: `Ripasso · ${appName}`,
    heading: "Ripasso",
    dueHeading: "Da ripassare oggi",
    /** A count of cards of one kind: "3 parole", "1 esercizio". */
    kindCount: (kind: CardKind, count: number) => `${count} ${count === 1 ? cardKindName[kind].one : cardKindName[kind].many}`,
    /** The due counts by kind, the kinds with none left out: "3 parole e 2 esercizi da ripassare". */
    dueCount: (counts: Readonly<Record<CardKind, number>>) => `${kindCounts(counts)} da ripassare`,
    nothingDue: "Oggi non hai niente da ripassare.",
    unreachable: "Il ripasso non è disponibile: il database non risponde.",
    start: "Inizia il ripasso",
    /** Above each card: where its exercise comes from. */
    source: (lessonTitle: string, stepTitle: string) => `${lessonTitle} · ${stepTitle}`,
    /** The session's progress: "2 / 20". */
    counter: (number: number, total: number) => `${number} / ${total}`,
    next: "Avanti",
    finish: "Fine",
    summaryHeading: "Ripasso finito",
    /** The cards reviewed, by kind: "Hai ripassato 3 parole e 2 esercizi." */
    summaryCount: (counts: Readonly<Record<CardKind, number>>) => `Hai ripassato ${kindCounts(counts)}.`,
    /** A vocab card (SPEC §10.5): the front asks for the Italian, Gira turns it over. */
    vocabPrompt: "Come si dice in italiano?",
    flip: "Gira",
    /** The grades as SPEC §10.5 names them: the vocab card's four buttons, and the summary's counts. */
    grade: { again: "Ancora", hard: "Difficile", good: "Bene", easy: "Facile" } satisfies Record<Grade, string>,
    /** One line of the summary: "Bene: 4". */
    gradeCount: (grade: Grade, count: number) => `${ui.review.grade[grade]}: ${count}`,
    /** Another session: "Altri 20". */
    more: (count: number) => `Altri ${count}`,
    backToHub: "Torna al ripasso",
    /** An error card (SPEC §10.5): the wrong version struck through, the corrected one to type. */
    errorSource: "Una tua correzione",
    errorGiven: "Hai detto:",
    errorPrompt: "Scrivi la versione corretta.",
    errorInput: "La versione corretta",
    /** The toggle that shows the tags' English explanations. */
    info: "Info",
    /** The second panel of the hub (SPEC §10.5): the top error tags, each starting a tag drill. */
    topTags: {
      heading: "I miei errori più frequenti",
      intro: (days: number) => `Gli errori non ancora risolti degli ultimi ${days} giorni. Scegline uno per esercitarti.`,
      /** How many unresolved errors carry the tag: "3 errori". */
      count: (count: number) => (count === 1 ? "1 errore" : `${count} errori`),
      none: (days: number) => `Negli ultimi ${days} giorni non hai errori da ripassare.`,
    },
    /** A tag drill (SPEC §10.5). */
    drill: {
      /** Above the drill: the tag it practises. */
      heading: (tag: string) => `Esercitazione: ${tag}`,
      none: "Nelle lezioni completate non ci sono esercizi con questo errore.",
    },
    /** The third panel of the hub (SPEC §10.5). */
    correction: {
      heading: "Aggiungi una correzione",
      given: "Cosa hai detto",
      expected: "Versione corretta",
      tags: "Tipi di errore",
      note: "Nota (facoltativa)",
      save: "Salva la correzione",
      saved: "Correzione salvata: la ripasserai domani.",
    },
  },

  /** Impostazioni (SPEC §3, §10.1). */
  settings: {
    pageTitle: `Impostazioni · ${appName}`,
    heading: "Impostazioni",
    notLoaded: "Non è stato possibile caricare le impostazioni salvate: qui vedi quelle predefinite.",
    lessons: "Lezioni",
    ripasso: "Ripasso personale",
    ripassoHint: "Prima di Parla!, fino a tre esercizi da ripassare presi da altre lezioni.",
    scene: "Scena",
    sceneHint: "Come si apre il lettore della scena. Nel lettore puoi sempre cambiarli.",
    subtitles: "Sottotitoli",
    speed: "Velocità",
    voice: "Voce italiana",
    voiceHint: "Vale solo per questo computer: ogni computer ha le sue voci.",
    noVoice: "Su questo computer non c'è una voce italiana.",
  },

  /** The status circle's tooltip, e.g. "Completata · 87%". */
  lessonStatus: (status: LessonStatus, bestPercent?: number) =>
    bestPercent === undefined ? lessonStatusName[status] : `${lessonStatusName[status]} · ${bestPercent}%`,
} as const;
