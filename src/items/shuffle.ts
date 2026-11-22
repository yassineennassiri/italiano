/**
 * Seeded shuffling for tile items (word_order, word_bank): the item id is the
 * seed, so tiles are shown in the same order across reloads and computers.
 */

/** FNV-1a: a 32-bit hash of the item id, the same on every computer. */
function seedOf(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32, seeded by the item id: a generator of numbers in [0, 1). */
export function seededRandom(id: string): () => number {
  let state = seedOf(id);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The indexes 0 … count − 1, Fisher–Yates shuffled with `random`. */
export function shuffledIndexes(count: number, random: () => number): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
