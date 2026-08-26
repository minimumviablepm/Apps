/** Deterministic-friendly random helpers shared by the puzzle pipeline. */

export type RandomSource = () => number;

/** Mulberry32 — small, fast, seedable. Used by the build-time generator so a
 *  given seed always produces the same puzzle set. */
export function seededRandom(seed: number): RandomSource {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inclusive on both ends. */
export function randomInt(min: number, max: number, random: RandomSource = Math.random): number {
  if (max < min) return min;
  return min + Math.floor(random() * (max - min + 1));
}

export function pick<T>(items: readonly T[], random: RandomSource = Math.random): T {
  if (items.length === 0) throw new Error('pick() called with an empty list');
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))] as T;
}

/** Fisher-Yates. Returns a new array; the input is untouched. */
export function shuffle<T>(items: readonly T[], random: RandomSource = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}
