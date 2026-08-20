import { getTierPuzzles } from '@/data/puzzleLoader';
import { PuzzleQueue, TYPE_WEIGHTS } from '@/utils/puzzleQueue';
import { seededRandom } from '@/utils/random';

describe('PuzzleQueue', () => {
  it('never serves the same puzzle twice inside a round', () => {
    const queue = new PuzzleQueue(getTierPuzzles(3), seededRandom(1));
    for (let round = 0; round < 20; round += 1) {
      queue.startRound();
      const seen = new Set<string>();
      // Far more than the 8-12 a real round serves, to stress the pool.
      for (let i = 0; i < 40; i += 1) {
        const puzzle = queue.next();
        if (!puzzle) break;
        expect(seen.has(puzzle.id)).toBe(false);
        seen.add(puzzle.id);
      }
      expect(seen.size).toBe(40);
    }
  });

  it('serves the 50/25/25 type mix over many rounds', () => {
    const queue = new PuzzleQueue(getTierPuzzles(5), seededRandom(99));
    const counts = { door_selection: 0, drag_and_drop: 0, pattern_completion: 0 };
    let total = 0;
    for (let round = 0; round < 500; round += 1) {
      queue.startRound();
      for (let i = 0; i < 10; i += 1) {
        const puzzle = queue.next();
        if (!puzzle) break;
        counts[puzzle.type] += 1;
        total += 1;
      }
    }
    expect(counts.door_selection / total).toBeCloseTo(TYPE_WEIGHTS.door_selection / 100, 1);
    expect(counts.drag_and_drop / total).toBeCloseTo(TYPE_WEIGHTS.drag_and_drop / 100, 1);
    expect(counts.pattern_completion / total).toBeCloseTo(TYPE_WEIGHTS.pattern_completion / 100, 1);
  });

  it('reshuffles and keeps serving once a pool is exhausted', () => {
    const queue = new PuzzleQueue(getTierPuzzles(1), seededRandom(4));
    const served: string[] = [];
    for (let round = 0; round < 30; round += 1) {
      queue.startRound();
      for (let i = 0; i < 12; i += 1) {
        const puzzle = queue.next();
        expect(puzzle).not.toBeNull();
        served.push(puzzle!.id);
      }
    }
    expect(served).toHaveLength(360);
    // Everything in the pool gets used rather than a favoured subset.
    expect(new Set(served).size).toBe(60);
  });

  it('returns null only when the whole pool has been served this round', () => {
    const queue = new PuzzleQueue(getTierPuzzles(2), seededRandom(8));
    queue.startRound();
    for (let i = 0; i < 60; i += 1) expect(queue.next()).not.toBeNull();
    expect(queue.next()).toBeNull();
  });
});
