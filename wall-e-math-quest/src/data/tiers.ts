import type { TierDefinition } from '@/types';

/** PRD Section 6 — Difficulty tiers & math curriculum. */
export const TIERS: TierDefinition[] = [
  {
    tierId: 1,
    label: 'Tiny Collector',
    minAge: 3,
    maxAge: 4,
    topics: ['counting_1_10', 'number_recognition', 'color_shape_matching', 'more_vs_fewer'],
  },
  {
    tierId: 2,
    label: 'Junior Sorter',
    minAge: 4,
    maxAge: 5,
    topics: ['counting_1_20', 'addition_within_10', 'shape_names', 'size_ordering'],
  },
  {
    tierId: 3,
    label: 'Explorer',
    minAge: 5,
    maxAge: 6,
    topics: ['addition_within_20', 'subtraction_within_20', 'place_value', 'shape_properties', 'skip_counting'],
  },
  {
    tierId: 4,
    label: 'Builder',
    minAge: 6,
    maxAge: 7,
    topics: ['addition_within_100', 'subtraction_within_100', 'multiplication_intro', 'measurement', 'time_hours'],
  },
  {
    tierId: 5,
    label: 'Navigator',
    minAge: 7,
    maxAge: 8,
    topics: ['multiplication_facts', 'division_facts', 'fractions_intro', 'perimeter', 'money'],
  },
  {
    tierId: 6,
    label: 'Engineer',
    minAge: 8,
    maxAge: 9,
    topics: ['multi_digit_addition', 'multi_digit_subtraction', 'long_multiplication', 'equivalent_fractions', 'area', 'bar_graphs', 'rounding'],
  },
  {
    tierId: 7,
    label: 'Commander',
    minAge: 9,
    maxAge: 10,
    topics: ['division_with_remainders', 'mixed_numbers', 'decimals_intro', 'order_of_operations', 'coordinates'],
  },
  {
    tierId: 8,
    label: 'Captain',
    minAge: 10,
    maxAge: 11,
    topics: ['fraction_operations', 'decimal_operations', 'volume', 'data_mean_median', 'expression_evaluation'],
  },
];

export const TIER_COUNT = TIERS.length;
export const MIN_AGE = 3;
export const MAX_AGE = 11;

export function getTier(tierId: number): TierDefinition {
  const tier = TIERS.find((t) => t.tierId === tierId);
  if (!tier) throw new Error(`Unknown tier: ${tierId}`);
  return tier;
}

/**
 * Maps the age chosen at profile setup to a starting tier (PRD Section 6).
 * Ages outside 3-11 clamp to the nearest tier rather than throwing, so a bad
 * value can never wedge the player out of the game.
 */
export function tierForAge(age: number): number {
  if (age <= MIN_AGE) return 1;
  if (age >= MAX_AGE) return TIER_COUNT;
  // Age ranges overlap by design (3-4, 4-5, 5-6 ...). The first matching tier
  // is the gentler entry point, which is what we want for a starting tier.
  const match = TIERS.find((t) => age >= t.minAge && age <= t.maxAge);
  return match ? match.tierId : 1;
}
