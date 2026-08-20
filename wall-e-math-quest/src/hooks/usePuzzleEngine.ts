import { useCallback, useMemo, useRef, useState } from 'react';

import type { Puzzle, PuzzleType, RoundResult } from '@/types';
import { getTierPuzzles } from '@/data/puzzleLoader';
import { PuzzleQueue } from '@/utils/puzzleQueue';

/**
 * PRD Section 5.1 / AC-4 — the player gets the initial attempt plus this many
 * retries on the same puzzle before it auto-skips with the answer shown.
 */
export const MAX_RETRIES = 2;

export interface PuzzleAttemptResult {
  /** Was this attempt right? */
  correct: boolean;
  /** True once the puzzle is finished (right, or out of retries). */
  resolved: boolean;
  /** True when the puzzle resolved unsolved and the answer is being revealed. */
  revealed: boolean;
  retriesUsed: number;
}

const emptyBreakdown = () => ({
  doorSelection: { attempted: 0, correct: 0 },
  dragAndDrop: { attempted: 0, correct: 0 },
  patternCompletion: { attempted: 0, correct: 0 },
});

const BREAKDOWN_KEY: Record<PuzzleType, keyof ReturnType<typeof emptyBreakdown>> = {
  door_selection: 'doorSelection',
  drag_and_drop: 'dragAndDrop',
  pattern_completion: 'patternCompletion',
};

export interface PuzzleEngine {
  currentPuzzle: Puzzle | null;
  score: number;
  attempted: number;
  retriesUsed: number;
  /** Registers one attempt at the current puzzle. */
  submitAttempt: (correct: boolean) => PuzzleAttemptResult;
  /** Moves to the next puzzle. Returns null when the pool is spent. */
  advance: () => Puzzle | null;
  /** Snapshots the round for persistence. */
  buildResult: (durationMs: number) => RoundResult;
  begin: () => Puzzle | null;
}

/**
 * Owns everything about a single round: which puzzle is on screen, the retry
 * budget, the running score and the per-type breakdown the score screen and
 * round history need.
 */
export function usePuzzleEngine(tierId: number): PuzzleEngine {
  const queue = useMemo(() => new PuzzleQueue(getTierPuzzles(tierId)), [tierId]);

  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [score, setScore] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [retriesUsed, setRetriesUsed] = useState(0);

  const breakdown = useRef(emptyBreakdown());
  // Guards against a puzzle being counted twice if a stray tap lands during
  // the reveal animation.
  const resolvedIds = useRef(new Set<string>());

  const begin = useCallback(() => {
    queue.startRound();
    breakdown.current = emptyBreakdown();
    resolvedIds.current = new Set();
    setScore(0);
    setAttempted(0);
    setRetriesUsed(0);
    const first = queue.next();
    setCurrentPuzzle(first);
    return first;
  }, [queue]);

  const advance = useCallback(() => {
    const next = queue.next();
    setCurrentPuzzle(next);
    setRetriesUsed(0);
    return next;
  }, [queue]);

  const submitAttempt = useCallback(
    (correct: boolean): PuzzleAttemptResult => {
      const puzzle = currentPuzzle;
      if (!puzzle || resolvedIds.current.has(puzzle.id)) {
        return { correct, resolved: true, revealed: false, retriesUsed };
      }

      const key = BREAKDOWN_KEY[puzzle.type];

      if (correct) {
        resolvedIds.current.add(puzzle.id);
        breakdown.current[key].attempted += 1;
        breakdown.current[key].correct += 1;
        setScore((s) => s + 1);
        setAttempted((a) => a + 1);
        return { correct: true, resolved: true, revealed: false, retriesUsed };
      }

      const nextRetries = retriesUsed + 1;
      setRetriesUsed(nextRetries);

      if (nextRetries > MAX_RETRIES) {
        resolvedIds.current.add(puzzle.id);
        breakdown.current[key].attempted += 1;
        setAttempted((a) => a + 1);
        return { correct: false, resolved: true, revealed: true, retriesUsed: nextRetries };
      }

      return { correct: false, resolved: false, revealed: false, retriesUsed: nextRetries };
    },
    [currentPuzzle, retriesUsed],
  );

  const buildResult = useCallback(
    (durationMs: number): RoundResult => ({
      tierId,
      timestamp: new Date().toISOString(),
      score,
      totalPuzzles: attempted,
      // A round where nothing was attempted scores 0% rather than NaN
      // (PRD Section 15: "Player answers nothing for 60s").
      percentage: attempted === 0 ? 0 : Math.round((score / attempted) * 100),
      durationMs,
      puzzleBreakdown: {
        doorSelection: { ...breakdown.current.doorSelection },
        dragAndDrop: { ...breakdown.current.dragAndDrop },
        patternCompletion: { ...breakdown.current.patternCompletion },
      },
    }),
    [tierId, score, attempted],
  );

  return {
    currentPuzzle,
    score,
    attempted,
    retriesUsed,
    submitAttempt,
    advance,
    buildResult,
    begin,
  };
}
