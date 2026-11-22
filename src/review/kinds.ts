/** The three kinds of review card (CONTEXT.md, SPEC §10.5): vocab, item, error. */
export const cardKinds = ["vocab", "item", "error"] as const;
/** A review card's kind. */
export type CardKind = (typeof cardKinds)[number];

/** The kinds a review session shows, in the order its counts list them; error cards come with *Aggiungi una correzione*. */
export const sessionCardKinds = ["vocab", "item"] as const satisfies readonly CardKind[];
/** A kind of card a review session shows. */
export type SessionCardKind = (typeof sessionCardKinds)[number];

/** How many cards of each kind a session shows are in `cards`. */
export function countByKind(cards: readonly { kind: SessionCardKind }[]): Record<SessionCardKind, number> {
  return Object.fromEntries(sessionCardKinds.map((kind) => [kind, cards.filter((card) => card.kind === kind).length])) as Record<
    SessionCardKind,
    number
  >;
}
