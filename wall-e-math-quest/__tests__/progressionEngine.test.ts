import type { GameState, PlayerProfile, RoundResult } from '@/types';
import {
  PASSES_TO_UNLOCK,
  ROUND_HISTORY_LIMIT,
  applyRoundResult,
  initialGameState,
  initialTiers,
  roundsUntilUnlock,
  starRatingFor,
} from '@/utils/progressionEngine';
import { tierForAge } from '@/data/tiers';

const profile = (age: number): PlayerProfile => ({
  id: 'test-id',
  name: 'Test',
  age,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const round = (tierId: number, score: number, total: number): RoundResult => ({
  tierId,
  timestamp: '2026-01-01T00:00:00.000Z',
  score,
  totalPuzzles: total,
  percentage: total === 0 ? 0 : Math.round((score / total) * 100),
  durationMs: 60_000,
  puzzleBreakdown: {
    doorSelection: { attempted: total, correct: score },
    dragAndDrop: { attempted: 0, correct: 0 },
    patternCompletion: { attempted: 0, correct: 0 },
  },
});

describe('star ratings (PRD Screen 4)', () => {
  it.each([
    [0, 0],
    [39, 0],
    [40, 1],
    [59, 1],
    [60, 2],
    [79, 2],
    [80, 3],
    [100, 3],
  ])('%i%% earns %i stars', (percentage, stars) => {
    expect(starRatingFor(percentage)).toBe(stars);
  });
});

describe('age to tier mapping (PRD Section 6)', () => {
  it.each([
    [3, 1],
    [4, 1],
    [5, 2],
    [6, 3],
    [7, 4],
    [8, 5],
    [9, 6],
    [10, 7],
    [11, 8],
  ])('age %i starts at tier %i', (age, tier) => {
    expect(tierForAge(age)).toBe(tier);
  });

  it('unlocks every tier up to the starting tier and none beyond', () => {
    const tiers = initialTiers(8); // tier 5
    expect(tiers.filter((t) => t.isUnlocked).map((t) => t.tierId)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('AC-7: tier unlock after 3 consecutive passing rounds', () => {
  const play = (state: GameState, results: RoundResult[]) =>
    results.reduce(
      (acc, result) => {
        const outcome = applyRoundResult(acc.state, result);
        return { state: outcome.state, last: outcome };
      },
      { state, last: null as ReturnType<typeof applyRoundResult> | null },
    );

  it('does not unlock after two passing rounds', () => {
    const start = initialGameState(profile(3));
    const { state, last } = play(start, [round(1, 7, 10), round(1, 8, 10)]);
    expect(last?.unlockedTierId).toBeNull();
    expect(state.tiers[1]?.isUnlocked).toBe(false);
    expect(state.tiers[0]?.consecutivePasses).toBe(2);
  });

  it('unlocks the next tier on the third consecutive pass', () => {
    const start = initialGameState(profile(3));
    const { state, last } = play(start, [round(1, 7, 10), round(1, 7, 10), round(1, 7, 10)]);
    expect(last?.unlockedTierId).toBe(2);
    expect(state.tiers[1]?.isUnlocked).toBe(true);
  });

  it('treats exactly 70% as a pass and 69% as a fail', () => {
    const start = initialGameState(profile(3));
    const passes = play(start, [round(1, 7, 10), round(1, 7, 10)]);
    expect(passes.state.tiers[0]?.consecutivePasses).toBe(2);

    // 69/100 -> 69%
    const failed = applyRoundResult(passes.state, round(1, 69, 100));
    expect(failed.passed).toBe(false);
    expect(failed.state.tiers[0]?.consecutivePasses).toBe(0);
    expect(failed.unlockedTierId).toBeNull();
  });

  it('never re-locks a tier and never unlocks past tier 8', () => {
    let state = initialGameState(profile(11)); // all 8 unlocked
    for (let i = 0; i < PASSES_TO_UNLOCK; i += 1) {
      state = applyRoundResult(state, round(8, 10, 10)).state;
    }
    expect(state.tiers).toHaveLength(8);
    expect(state.tiers.every((t) => t.isUnlocked)).toBe(true);
  });

  it('reports how many rounds are still needed', () => {
    expect(roundsUntilUnlock(0)).toBe(3);
    expect(roundsUntilUnlock(2)).toBe(1);
    expect(roundsUntilUnlock(5)).toBe(0);
  });
});

describe('tier statistics', () => {
  it('keeps the best score, percentage and star rating', () => {
    let state = initialGameState(profile(3));
    state = applyRoundResult(state, round(1, 9, 10)).state; // 90%, 3 stars
    state = applyRoundResult(state, round(1, 2, 10)).state; // 20%, 0 stars

    const tier = state.tiers[0];
    expect(tier?.bestScore).toBe(9);
    expect(tier?.bestPercentage).toBe(90);
    expect(tier?.starRating).toBe(3);
    expect(tier?.totalRoundsPlayed).toBe(2);
    expect(tier?.totalCorrectAnswers).toBe(11);
  });

  it('scores an untouched round as 0% without dividing by zero', () => {
    const state = initialGameState(profile(3));
    const outcome = applyRoundResult(state, round(1, 0, 0));
    expect(outcome.passed).toBe(false);
    expect(outcome.roundStars).toBe(0);
    expect(Number.isNaN(outcome.state.roundHistory[0]?.percentage)).toBe(false);
  });

  it('leaves tier progress alone when nothing was attempted (PRD Section 15)', () => {
    let state = initialGameState(profile(3));
    state = applyRoundResult(state, round(1, 8, 10)).state;
    state = applyRoundResult(state, round(1, 8, 10)).state;

    const outcome = applyRoundResult(state, round(1, 0, 0));
    // The streak survives, and the round still lands in history.
    expect(outcome.state.tiers[0]?.consecutivePasses).toBe(2);
    expect(outcome.state.tiers[0]?.totalRoundsPlayed).toBe(2);
    expect(outcome.state.roundHistory).toHaveLength(3);

    // ...so a third real pass still unlocks.
    expect(applyRoundResult(outcome.state, round(1, 8, 10)).unlockedTierId).toBe(2);
  });

  it('caps round history at 50 entries, oldest first out', () => {
    let state = initialGameState(profile(3));
    for (let i = 0; i < ROUND_HISTORY_LIMIT + 5; i += 1) {
      state = applyRoundResult(state, { ...round(1, i % 10, 10), timestamp: `t${i}` }).state;
    }
    expect(state.roundHistory).toHaveLength(ROUND_HISTORY_LIMIT);
    expect(state.roundHistory[0]?.timestamp).toBe('t5');
    expect(state.roundHistory[ROUND_HISTORY_LIMIT - 1]?.timestamp).toBe('t54');
  });
});
