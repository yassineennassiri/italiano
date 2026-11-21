/**
 * Every UI string of the app, in Italian (SPEC §6.3, ADR-0003). Components
 * never hard-code text; ESLint enforces that in src/app and src/components.
 * Content text (titles, topics, descriptions) comes from the content files.
 */

import type { LevelId } from "@/content/ids";
import type { LessonPage } from "@/content/lesson-nav";
import type { Note } from "@/content/schema";
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
  },

  footer: {
    contentVersion: (version: string) => `Contenuti ${version}`,
    /** The sync status (SPEC §8). */
    sync: {
      saved: "Salvato",
      pending: "In attesa",
      offline: "Offline: non salvato",
    } satisfies Record<SyncStatus, string>,
  },

  comingSoon: "In arrivo",

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
  },

  level: {
    pageTitle: (levelTitle: string) => `${levelTitle} · ${appName}`,
    /** The level status circle's tooltip, e.g. "Livello: Non iniziato". */
    levelStatus: (status: LessonStatus) => `Livello: ${levelStatusName[status]}`,
    finalTest: "Test finale",
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
      corso: "Panoramica del corso",
    } satisfies Record<LessonPage, string>,
    breadcrumb: "Percorso",
    course: "Corso",

    /** The intro page (SPEC §4.1). */
    posterAlt: (lessonTitle: string) => `Scena della lezione: ${lessonTitle}`,
    /** The scene length on the poster: 58 → "00:58". */
    duration: (seconds: number) =>
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.round(seconds % 60)).padStart(2, "0")}`,
    objectives: "In questa lezione impari a…",
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
    /** Read out with the ✓ and ✗ icons. */
    correct: "Giusto",
    wrong: "Sbagliato",
    /** SPEC §6.2; the nouns agree with the total, the points with their count. */
    footerCounter: ({ completed, total, points }: { completed: number; total: number; points: number }) =>
      `${completed} di ${total} ${total === 1 ? "esercizio completato" : "esercizi completati"}. ` +
      `${points} ${points === 1 ? "punto" : "punti"}.`,

    /** Headings of the pages later issues fill in. */
    results: "Risultati della lezione",
    grammar: "Grammatica",
    vocabulary: "Vocabolario",
    culture: "Cultura e società",
  },

  /** The status circle's tooltip, e.g. "Completata · 87%". */
  lessonStatus: (status: LessonStatus, bestPercent?: number) =>
    bestPercent === undefined ? lessonStatusName[status] : `${lessonStatusName[status]} · ${bestPercent}%`,
} as const;
