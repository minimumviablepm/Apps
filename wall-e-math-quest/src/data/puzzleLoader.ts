import type { Puzzle } from '@/types';

import tier1 from './puzzles/tier1.json';
import tier2 from './puzzles/tier2.json';
import tier3 from './puzzles/tier3.json';
import tier4 from './puzzles/tier4.json';
import tier5 from './puzzles/tier5.json';
import tier6 from './puzzles/tier6.json';
import tier7 from './puzzles/tier7.json';
import tier8 from './puzzles/tier8.json';

/**
 * Static requires so Metro bundles every tier — the runtime never generates
 * content (PRD Open Question #1, resolved in favour of build-time JSON).
 */
// The JSON is generated and validated by scripts/generate-puzzles.mjs, which
// enforces the Puzzle shape far more thoroughly than TypeScript can infer from
// a literal file — hence the cast through unknown.
const asPool = (raw: unknown): Puzzle[] => raw as Puzzle[];

const POOLS: Record<number, Puzzle[]> = {
  1: asPool(tier1),
  2: asPool(tier2),
  3: asPool(tier3),
  4: asPool(tier4),
  5: asPool(tier5),
  6: asPool(tier6),
  7: asPool(tier7),
  8: asPool(tier8),
};

export function getTierPuzzles(tierId: number): Puzzle[] {
  const pool = POOLS[tierId];
  if (!pool) throw new Error(`No puzzle pool for tier ${tierId}`);
  return pool;
}

export function allPuzzles(): Puzzle[] {
  return Object.values(POOLS).flat();
}
