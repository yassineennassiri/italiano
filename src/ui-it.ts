/**
 * Every UI string of the app, in Italian (SPEC §6.3, ADR-0003). Components
 * never hard-code text; ESLint enforces that in src/app and src/components.
 * Content text (titles, topics, descriptions) comes from the content files.
 */

import type { LevelId } from "@/content/ids";
import type { LessonStatus } from "@/scoring/lesson";

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
  },

  comingSoon: "In arrivo",
  draft: "Bozza",
  /** The round level badge: "A2", "B1", "B2". */
  levelBadge: (levelId: LevelId) => levelId.toUpperCase(),

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

  /** The status circle's tooltip, e.g. "Completata · 87%". */
  lessonStatus: (status: LessonStatus, bestPercent?: number) =>
    bestPercent === undefined ? lessonStatusName[status] : `${lessonStatusName[status]} · ${bestPercent}%`,
} as const;
