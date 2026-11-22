/** The three kinds of review card (CONTEXT.md, SPEC §10.5): vocab, item, error. */
export const cardKinds = ["vocab", "item", "error"] as const;
export type CardKind = (typeof cardKinds)[number];

/** The kinds a review session shows, in the order its counts list them; error cards come with *Aggiungi una correzione*. */
export const sessionCardKinds = ["vocab", "item"] as const satisfies readonly CardKind[];
export type SessionCardKind = (typeof sessionCardKinds)[number];
