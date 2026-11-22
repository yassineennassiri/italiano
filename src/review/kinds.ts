/** The three kinds of review card (CONTEXT.md, SPEC §10.5): vocab, item, error. A review session mixes all three. */
export const cardKinds = ["vocab", "item", "error"] as const;
/** A review card's kind. */
export type CardKind = (typeof cardKinds)[number];

/** How many cards of each kind are in `cards`. */
export function countByKind(cards: readonly { kind: CardKind }[]): Record<CardKind, number> {
  return Object.fromEntries(cardKinds.map((kind) => [kind, cards.filter((card) => card.kind === kind).length])) as Record<CardKind, number>;
}
