import { randomInt, shuffle, type RandomSource } from './random';

/**
 * PRD Section 12.2 — distractor generation rules:
 *  - Distractors must be plausible (within +/- 30% of the correct answer, or a
 *    common mistake pattern such as off-by-one / place-value slips).
 *  - Never generate negative distractors for Tiers 1-4.
 *  - Fraction distractors keep the same denominator or model common
 *    equivalent-fraction errors.
 */

export interface NumericDistractorOptions {
  /** Tier the puzzle belongs to; tiers 1-4 forbid negative distractors. */
  tierId: number;
  /** Hard ceiling for generated values, when the topic has one. */
  max?: number;
  /** Extra "common mistake" candidates supplied by the caller (e.g. a + b - 1). */
  commonMistakes?: number[];
  /** Allow non-integers (used by decimal topics). */
  decimals?: number;
}

const NEGATIVE_FORBIDDEN_MAX_TIER = 4;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Produces `count` plausible, unique wrong answers for a numeric `correct`.
 * Candidates are ranked: caller-supplied mistake patterns first, then near
 * misses, then a widening band capped at +/-30%.
 */
export function generateDistractors(
  correct: number,
  count: number,
  options: NumericDistractorOptions,
  random: RandomSource = Math.random,
): number[] {
  const { tierId, max, commonMistakes = [], decimals = 0 } = options;
  const allowNegative = tierId > NEGATIVE_FORBIDDEN_MAX_TIER;
  const step = decimals > 0 ? 10 ** -decimals : 1;
  const band = Math.max(step, Math.abs(correct) * 0.3);

  const isUsable = (value: number): boolean => {
    if (!Number.isFinite(value)) return false;
    if (value === correct) return false;
    if (!allowNegative && value < 0) return false;
    if (max !== undefined && value > max) return false;
    if (decimals === 0 && !Number.isInteger(value)) return false;
    return true;
  };

  const seen = new Set<number>([correct]);
  const out: number[] = [];
  const take = (value: number) => {
    const v = round(value, decimals);
    if (!isUsable(v) || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };

  // 1. Common mistake patterns supplied by the puzzle template.
  shuffle(commonMistakes, random).forEach(take);

  // 2. Near misses — the classic off-by-one/off-by-step slips.
  shuffle([correct + step, correct - step, correct + 2 * step, correct - 2 * step], random).forEach(
    take,
  );

  // 3. Widening band, still inside +/-30%.
  let guard = 0;
  while (out.length < count && guard < 200) {
    guard += 1;
    const offset = round(randomInt(1, Math.max(1, Math.round(band / step)), random) * step, decimals);
    take(correct + (random() < 0.5 ? -offset : offset));
  }

  // 4. Last resort: step upward until we have enough. Keeps the puzzle valid
  //    even for tiny answers (e.g. correct = 1 with negatives forbidden).
  let fallback = correct + step;
  while (out.length < count && guard < 400) {
    guard += 1;
    take(fallback);
    fallback = round(fallback + step, decimals);
  }

  return out.slice(0, count);
}

export interface Fraction {
  numerator: number;
  denominator: number;
}

export function formatFraction(f: Fraction): string {
  return `${f.numerator}/${f.denominator}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

export function simplifyFraction({ numerator, denominator }: Fraction): Fraction {
  const divisor = gcd(numerator, denominator) || 1;
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

/**
 * Fraction distractors: same denominator first, then the two classic errors —
 * numerator/denominator swap, and "add across" (a/b + c/d = (a+c)/(b+d)).
 */
export function generateFractionDistractors(
  correct: Fraction,
  count: number,
  random: RandomSource = Math.random,
  extraCandidates: Fraction[] = [],
): Fraction[] {
  const correctKey = formatFraction(correct);
  const seen = new Set<string>([correctKey]);
  const out: Fraction[] = [];

  const take = (f: Fraction) => {
    // 0/n is never a plausible distractor for a non-zero answer, and a
    // negative numerator is not something these tiers have met yet.
    if (f.denominator <= 0 || f.numerator <= 0) return;
    const key = formatFraction(f);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(f);
  };

  extraCandidates.forEach(take);

  // Same denominator, numerator off by one or two.
  shuffle(
    [
      { numerator: correct.numerator + 1, denominator: correct.denominator },
      { numerator: correct.numerator - 1, denominator: correct.denominator },
      { numerator: correct.numerator + 2, denominator: correct.denominator },
    ],
    random,
  ).forEach(take);

  // Swapped numerator/denominator — a very common early error.
  if (correct.numerator > 0) {
    take({ numerator: correct.denominator, denominator: correct.numerator });
  }

  // Denominator drift.
  shuffle(
    [
      { numerator: correct.numerator, denominator: correct.denominator + 1 },
      { numerator: correct.numerator, denominator: Math.max(2, correct.denominator - 1) },
      { numerator: correct.numerator * 2, denominator: correct.denominator },
    ],
    random,
  ).forEach(take);

  let d = correct.denominator + 2;
  let guard = 0;
  while (out.length < count && guard < 50) {
    guard += 1;
    take({ numerator: Math.max(1, correct.numerator), denominator: d });
    d += 1;
  }

  return out.slice(0, count);
}
