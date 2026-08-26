import type { Puzzle, PuzzleType } from '@/types';
import { shuffle, type RandomSource } from './random';

/** PRD Section 5.3 — puzzle type mix inside a round. */
export const TYPE_WEIGHTS: Record<PuzzleType, number> = {
  door_selection: 50,
  drag_and_drop: 25,
  pattern_completion: 25,
};

const TYPES = Object.keys(TYPE_WEIGHTS) as PuzzleType[];

/**
 * Serves puzzles for a tier.
 *
 * - Type is picked by the 50/25/25 weighting on every draw.
 * - A puzzle is never repeated inside a single round.
 * - Each type keeps its own shuffled queue that survives across rounds and
 *   reshuffles once exhausted (PRD Section 12.1).
 */
export class PuzzleQueue {
  private readonly byType: Record<PuzzleType, Puzzle[]>;
  private queues: Record<PuzzleType, Puzzle[]>;
  private servedThisRound = new Set<string>();
  private readonly random: RandomSource;

  constructor(pool: Puzzle[], random: RandomSource = Math.random) {
    this.random = random;
    this.byType = {
      door_selection: pool.filter((p) => p.type === 'door_selection'),
      drag_and_drop: pool.filter((p) => p.type === 'drag_and_drop'),
      pattern_completion: pool.filter((p) => p.type === 'pattern_completion'),
    };
    this.queues = {
      door_selection: shuffle(this.byType.door_selection, random),
      drag_and_drop: shuffle(this.byType.drag_and_drop, random),
      pattern_completion: shuffle(this.byType.pattern_completion, random),
    };
  }

  startRound(): void {
    this.servedThisRound = new Set();
  }

  private pickType(available: PuzzleType[]): PuzzleType {
    const total = available.reduce((sum, t) => sum + TYPE_WEIGHTS[t], 0);
    let roll = this.random() * total;
    for (const type of available) {
      roll -= TYPE_WEIGHTS[type];
      if (roll <= 0) return type;
    }
    return available[available.length - 1] as PuzzleType;
  }

  private drawFrom(type: PuzzleType): Puzzle | null {
    const source = this.byType[type];
    if (source.length === 0) return null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      while (this.queues[type].length > 0) {
        const next = this.queues[type].shift() as Puzzle;
        if (!this.servedThisRound.has(next.id)) return next;
      }
      // Pool exhausted — reshuffle and take one more pass. If everything in
      // this type has already been served this round, the caller falls back
      // to another type.
      this.queues[type] = shuffle(source, this.random);
      if (source.every((p) => this.servedThisRound.has(p.id))) return null;
    }
    return null;
  }

  /** Returns the next puzzle, or null when nothing is left to serve. */
  next(): Puzzle | null {
    const candidates = TYPES.filter((t) => this.byType[t].length > 0);
    let available = candidates.slice();

    while (available.length > 0) {
      const type = this.pickType(available);
      const puzzle = this.drawFrom(type);
      if (puzzle) {
        this.servedThisRound.add(puzzle.id);
        return puzzle;
      }
      available = available.filter((t) => t !== type);
    }
    return null;
  }
}
