/**
 * Every UI string of the app, in Italian (SPEC §6.3, ADR-0003). Components
 * never hard-code text; ESLint enforces that in src/app and src/components.
 * Content text (titles, topics, descriptions) comes from the content files.
 */

export type LessonStatus = "not_started" | "in_progress" | "completed";

const lessonStatusName: Record<LessonStatus, string> = {
  not_started: "Non iniziata",
  in_progress: "In corso",
  completed: "Completata",
};

export const ui = {
  appName: "La strada di Adam",
  appDescription: "Un corso di italiano personale, ambientato a Genova.",
  /** The word next to the Lanterna logo. */
  wordmark: "italiano",

  topBar: {
    homeLink: "La strada di Adam: home",
    openMenu: "Apri il menu",
    closeMenu: "Chiudi il menu",
    menuTitle: "Menu",
    home: "Home",
    levels: "Livelli",
  },

  footer: {
    contentVersion: (version: string) => `Contenuti ${version}`,
    sync: {
      saved: "Salvato",
      pending: "In attesa",
      offline: "Offline: non salvato",
    },
  },

  comingSoon: "In arrivo",
  draft: "Bozza",
  /** The round level badge: "A2", "B1", "B2". */
  levelBadge: (levelId: string) => levelId.toUpperCase(),

  home: {
    heading: "Scegli il livello",
    intro: "La storia di Adam, ingegnere appena arrivato a Genova: dal ripasso dell'A2 fino al B2.",
    continue: "Continua da dove eri",
  },

  level: {
    pageTitle: (levelTitle: string) => `${levelTitle} · La strada di Adam`,
    /** The level status circle's tooltip, e.g. "Livello: Non iniziata". */
    levelStatus: (status: LessonStatus) => `Livello: ${lessonStatusName[status]}`,
    finalTest: "Test finale",
  },

  /** The status circle's tooltip, e.g. "Completata · 87%". */
  lessonStatus: (status: LessonStatus, bestPercent?: number) =>
    bestPercent === undefined ? lessonStatusName[status] : `${lessonStatusName[status]} · ${bestPercent}%`,
} as const;
