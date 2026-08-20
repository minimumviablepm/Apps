import type { GameState, PlayerProfile, RoundResult, TierProgress } from '@/types';
import { TIERS, TIER_COUNT, tierForAge } from '@/data/tiers';

/** PRD Section 6.1 — a round "passes" at 70% or better. */
export const PASS_THRESHOLD = 70;
/** PRD Section 6.1 — three consecutive passes unlock the next tier. */
export const PASSES_TO_UNLOCK = 3;
/** PRD Section 11 — round history is capped at 50 entries, FIFO. */
export const ROUND_HISTORY_LIMIT = 50;

/** PRD Section 10, Screen 4 — star thresholds. */
export function starRatingFor(percentage: number): number {
  if (percentage >= 80) return 3;
  if (percentage >= 60) return 2;
  if (percentage >= 40) return 1;
  return 0;
}

export function emptyTierProgress(tierId: number, isUnlocked: boolean): TierProgress {
  return {
    tierId,
    isUnlocked,
    bestScore: 0,
    bestPercentage: 0,
    starRating: 0,
    consecutivePasses: 0,
    totalRoundsPlayed: 0,
    totalCorrectAnswers: 0,
  };
}

/**
 * Builds the initial tier array. Everything below and including the player's
 * age-mapped starting tier is unlocked, so a 10-year-old is not made to grind
 * through counting to ten.
 */
export function initialTiers(age: number): TierProgress[] {
  const startingTier = tierForAge(age);
  return TIERS.map((tier) => emptyTierProgress(tier.tierId, tier.tierId <= startingTier));
}

export function initialGameState(profile: PlayerProfile): GameState {
  return {
    profile,
    tiers: initialTiers(profile.age),
    roundHistory: [],
    settings: { soundEnabled: true, musicEnabled: true },
  };
}

export interface ApplyRoundOutcome {
  state: GameState;
  /** Tier id that just unlocked, if any — drives the unlock animation. */
  unlockedTierId: number | null;
  /** Star rating earned by this round (not the tier's best). */
  roundStars: number;
  passed: boolean;
}

/**
 * Folds a finished round into the game state: updates the tier's bests,
 * advances or resets the consecutive-pass counter, unlocks the next tier when
 * the counter reaches 3, and appends to the FIFO round history.
 *
 * Pure — callers persist the returned state.
 */
export function applyRoundResult(state: GameState, result: RoundResult): ApplyRoundOutcome {
  const passed = result.percentage >= PASS_THRESHOLD;
  const roundStars = starRatingFor(result.percentage);
  // PRD Section 15: a round where the player attempted nothing is recorded in
  // history but leaves tier progress alone — it should not burn a streak.
  const untouched = result.totalPuzzles === 0;
  let unlockedTierId: number | null = null;

  const tiers = state.tiers.map((tier) => {
    if (tier.tierId !== result.tierId || untouched) return tier;

    const consecutivePasses = passed ? tier.consecutivePasses + 1 : 0;
    return {
      ...tier,
      bestScore: Math.max(tier.bestScore, result.score),
      bestPercentage: Math.max(tier.bestPercentage, result.percentage),
      starRating: Math.max(tier.starRating, roundStars),
      consecutivePasses,
      totalRoundsPlayed: tier.totalRoundsPlayed + 1,
      totalCorrectAnswers: tier.totalCorrectAnswers + result.score,
    };
  });

  const playedTier = tiers.find((t) => t.tierId === result.tierId);
  const nextTierId = result.tierId + 1;
  const nextTier = tiers.find((t) => t.tierId === nextTierId);

  if (
    playedTier &&
    playedTier.consecutivePasses >= PASSES_TO_UNLOCK &&
    nextTierId <= TIER_COUNT &&
    nextTier &&
    !nextTier.isUnlocked
  ) {
    unlockedTierId = nextTierId;
  }

  const withUnlock = tiers.map((tier) =>
    tier.tierId === unlockedTierId ? { ...tier, isUnlocked: true } : tier,
  );

  const roundHistory = [...state.roundHistory, result].slice(-ROUND_HISTORY_LIMIT);

  return {
    state: { ...state, tiers: withUnlock, roundHistory },
    unlockedTierId,
    roundStars,
    passed,
  };
}

/** Rounds still needed at >= 70% before the next tier opens. */
export function roundsUntilUnlock(consecutivePasses: number): number {
  return Math.max(0, PASSES_TO_UNLOCK - consecutivePasses);
}

export function getTierProgress(state: GameState, tierId: number): TierProgress | undefined {
  return state.tiers.find((t) => t.tierId === tierId);
}
