import {
  formatFraction,
  generateDistractors,
  generateFractionDistractors,
  simplifyFraction,
} from '@/utils/distractorEngine';
import { seededRandom } from '@/utils/random';

describe('numeric distractors (PRD Section 12.2)', () => {
  const random = seededRandom(11);

  it('never generates negatives for tiers 1-4', () => {
    for (let tierId = 1; tierId <= 4; tierId += 1) {
      for (let correct = 1; correct <= 20; correct += 1) {
        const wrongs = generateDistractors(correct, 3, { tierId }, random);
        expect(wrongs).toHaveLength(3);
        wrongs.forEach((w) => expect(w).toBeGreaterThanOrEqual(0));
      }
    }
  });

  it('never repeats the correct answer or itself', () => {
    for (let correct = 2; correct <= 60; correct += 1) {
      const wrongs = generateDistractors(correct, 3, { tierId: 6 }, random);
      expect(new Set(wrongs).size).toBe(3);
      expect(wrongs).not.toContain(correct);
    }
  });

  it('respects an explicit maximum', () => {
    const wrongs = generateDistractors(9, 3, { tierId: 2, max: 10 }, random);
    wrongs.forEach((w) => expect(w).toBeLessThanOrEqual(10));
  });

  it('keeps generated values plausible', () => {
    // Everything not seeded by a caller-supplied mistake pattern stays inside
    // a +/-30% band (or one step away for small answers).
    for (let correct = 20; correct <= 200; correct += 20) {
      const wrongs = generateDistractors(correct, 3, { tierId: 6 }, random);
      wrongs.forEach((w) => {
        const drift = Math.abs(w - correct);
        expect(drift).toBeLessThanOrEqual(Math.max(2, correct * 0.3));
      });
    }
  });

  it('produces decimal distractors at the requested precision', () => {
    const wrongs = generateDistractors(3.25, 3, { tierId: 8, decimals: 2 }, random);
    wrongs.forEach((w) => expect(Number(w.toFixed(2))).toBe(w));
  });
});

describe('fraction distractors', () => {
  const random = seededRandom(5);

  it('never emits a zero numerator or a zero denominator', () => {
    for (let n = 1; n <= 6; n += 1) {
      const wrongs = generateFractionDistractors({ numerator: n, denominator: 8 }, 3, random);
      expect(wrongs).toHaveLength(3);
      wrongs.forEach((f) => {
        expect(f.numerator).toBeGreaterThan(0);
        expect(f.denominator).toBeGreaterThan(0);
      });
    }
  });

  it('never duplicates the correct fraction', () => {
    const correct = { numerator: 1, denominator: 3 };
    const wrongs = generateFractionDistractors(correct, 3, random);
    expect(wrongs.map(formatFraction)).not.toContain('1/3');
    expect(new Set(wrongs.map(formatFraction)).size).toBe(3);
  });
});

describe('simplifyFraction', () => {
  it.each([
    [{ numerator: 2, denominator: 4 }, '1/2'],
    [{ numerator: 6, denominator: 8 }, '3/4'],
    [{ numerator: 5, denominator: 7 }, '5/7'],
    [{ numerator: 12, denominator: 4 }, '3/1'],
  ])('%p simplifies to %s', (input, expected) => {
    expect(formatFraction(simplifyFraction(input))).toBe(expected);
  });
});
