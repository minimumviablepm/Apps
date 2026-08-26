import type { Puzzle, PuzzleType } from '@/types';
import { pick, randomInt, shuffle, type RandomSource } from './random';
import {
  formatFraction,
  generateDistractors,
  generateFractionDistractors,
  simplifyFraction,
  type Fraction,
} from './distractorEngine';

/**
 * PRD Section 12.2 — procedural generation for Tiers 3-8.
 *
 * Tiers 1-2 are hand-authored (see scripts/authored-content.mjs) because
 * developmental appropriateness for ages 3-5 is not something a template
 * gets right. Everything here is pure: give it the same seed and you get the
 * same puzzle set, which is what makes build-time generation reproducible.
 */

export interface GeneratedPuzzle extends Omit<Puzzle, 'id'> {}

type Template = (tierId: number, random: RandomSource) => GeneratedPuzzle;

// ---------------------------------------------------------------------------
// Shared builders
// ---------------------------------------------------------------------------

function doorPuzzle(
  tierId: number,
  mathTopic: string,
  prompt: string,
  correct: string,
  wrongs: string[],
  random: RandomSource,
): GeneratedPuzzle {
  return {
    type: 'door_selection',
    tierId,
    mathTopic,
    prompt,
    options: shuffle(
      [
        { label: correct, isCorrect: true },
        ...wrongs.map((label) => ({ label, isCorrect: false })),
      ],
      random,
    ),
  };
}

/** Doors per puzzle: 3 for the younger tiers, 4 once players can scan faster. */
function doorCount(tierId: number): number {
  return tierId <= 3 ? 3 : 4;
}

function numericDoorPuzzle(
  tierId: number,
  mathTopic: string,
  prompt: string,
  correct: number,
  random: RandomSource,
  opts: { max?: number; commonMistakes?: number[]; decimals?: number; suffix?: string } = {},
): GeneratedPuzzle {
  const { suffix = '', decimals = 0, ...rest } = opts;
  const wrongs = generateDistractors(
    correct,
    doorCount(tierId) - 1,
    { tierId, decimals, ...rest },
    random,
  );
  const format = (n: number) => `${decimals > 0 ? n.toFixed(decimals) : String(n)}${suffix}`;
  return doorPuzzle(tierId, mathTopic, prompt, format(correct), wrongs.map(format), random);
}

/** Builds an "arrange these in order" drag puzzle from a set of labelled values. */
function orderingDragPuzzle(
  tierId: number,
  mathTopic: string,
  prompt: string,
  /** Items already in their correct (target) order. */
  orderedLabels: string[],
  random: RandomSource,
): GeneratedPuzzle {
  const items = orderedLabels.map((label, index) => ({
    id: `item-${index}`,
    label,
    correctPosition: index,
  }));
  return {
    type: 'drag_and_drop',
    tierId,
    mathTopic,
    prompt,
    // Presentation order is scrambled; correctPosition carries the answer.
    draggableItems: shuffle(items, random),
  };
}

/**
 * Builds a pattern puzzle from a full sequence by blanking 1-2 cells and
 * filling the tray with the answers plus plausible decoys.
 */
function patternPuzzle(
  tierId: number,
  mathTopic: string,
  prompt: string,
  fullSequence: string[],
  blankCount: number,
  decoys: string[],
  random: RandomSource,
): GeneratedPuzzle {
  const blanks = Math.min(Math.max(1, blankCount), Math.max(1, fullSequence.length - 2));
  // Never blank the first cell — the player needs a starting anchor.
  const candidateIndexes = fullSequence.map((_, i) => i).filter((i) => i > 0);
  const chosen = shuffle(candidateIndexes, random).slice(0, blanks).sort((a, b) => a - b);

  const sequence = fullSequence.map((value, index) => ({
    value,
    isBlank: chosen.includes(index),
  }));
  const correctFills = chosen.map((i) => fullSequence[i] as string);
  const trayDecoys = decoys.filter((d) => !correctFills.includes(d)).slice(0, 3);

  return {
    type: 'pattern_completion',
    tierId,
    mathTopic,
    prompt,
    sequence,
    fillOptions: shuffle([...correctFills, ...trayDecoys], random),
    correctFills,
  };
}

function arithmeticSequence(start: number, step: number, length: number): number[] {
  return Array.from({ length }, (_, i) => start + i * step);
}

// ---------------------------------------------------------------------------
// Tier 3 — Explorer
// ---------------------------------------------------------------------------

const SHAPE_SIDES: ReadonlyArray<[string, number]> = [
  ['triangle', 3],
  ['square', 4],
  ['rectangle', 4],
  ['pentagon', 5],
  ['hexagon', 6],
  ['octagon', 8],
];

const TIER3_DOORS: Template[] = [
  (t, r) => {
    const a = randomInt(2, 15, r);
    const b = randomInt(1, 20 - a, r);
    return numericDoorPuzzle(t, 'addition_within_20', `What is ${a} + ${b}?`, a + b, r, {
      max: 30,
      commonMistakes: [a + b + 1, a + b - 1, a - b > 0 ? a - b : a + b + 10],
    });
  },
  (t, r) => {
    const a = randomInt(5, 20, r);
    const b = randomInt(1, a - 1, r);
    return numericDoorPuzzle(t, 'subtraction_within_20', `What is ${a} - ${b}?`, a - b, r, {
      max: 25,
      commonMistakes: [a - b + 1, a - b - 1, a + b],
    });
  },
  (t, r) => {
    const n = randomInt(11, 99, r);
    const asks = pick(['tens', 'ones'] as const, r);
    const correct = asks === 'tens' ? Math.floor(n / 10) : n % 10;
    return numericDoorPuzzle(
      t,
      'place_value',
      `How many ${asks} are in ${n}?`,
      correct,
      r,
      { max: 12, commonMistakes: [asks === 'tens' ? n % 10 : Math.floor(n / 10)] },
    );
  },
  (t, r) => {
    const [name, sides] = pick(SHAPE_SIDES, r);
    return numericDoorPuzzle(t, 'shape_properties', `How many sides does a ${name} have?`, sides, r, {
      max: 10,
    });
  },
  (t, r) => {
    const step = pick([2, 5, 10], r);
    const start = step * randomInt(1, 5, r);
    const terms = 4;
    const next = start + step * terms;
    const shown = arithmeticSequence(start, step, terms).join(', ');
    return numericDoorPuzzle(
      t,
      'skip_counting',
      `Skip count: ${shown}, ...  What comes next?`,
      next,
      r,
      { max: next + 20, commonMistakes: [next + step, next - step, next + 1] },
    );
  },
];

const TIER3_DRAGS: Template[] = [
  (t, r) => {
    const values = shuffle(Array.from({ length: 20 }, (_, i) => i + 1), r).slice(0, 4).sort((a, b) => a - b);
    return orderingDragPuzzle(
      t,
      'number_ordering',
      'Drag the numbers into order, smallest first.',
      values.map(String),
      r,
    );
  },
  (t, r) => {
    const step = pick([2, 5, 10], r);
    const start = step * randomInt(1, 4, r);
    return orderingDragPuzzle(
      t,
      'skip_counting',
      `Put the skip-count by ${step}s in order.`,
      arithmeticSequence(start, step, 4).map(String),
      r,
    );
  },
  (t, r) => {
    const pairs = shuffle(SHAPE_SIDES, r).slice(0, 4).sort((a, b) => a[1] - b[1]);
    return orderingDragPuzzle(
      t,
      'shape_properties',
      'Order the shapes from fewest sides to most sides.',
      pairs.map(([name]) => name),
      r,
    );
  },
];

const TIER3_PATTERNS: Template[] = [
  (t, r) => {
    const step = pick([2, 5, 10], r);
    const start = step * randomInt(1, 4, r);
    const seq = arithmeticSequence(start, step, 6).map(String);
    return patternPuzzle(
      t,
      'skip_counting',
      `Fill in the missing numbers. Counting by ${step}s.`,
      seq,
      randomInt(1, 2, r),
      arithmeticSequence(start + 1, step, 4).map(String),
      r,
    );
  },
  (t, r) => {
    const start = randomInt(1, 10, r);
    const seq = arithmeticSequence(start, 1, 6).map(String);
    return patternPuzzle(
      t,
      'counting_sequence',
      'Fill in the missing numbers.',
      seq,
      randomInt(1, 2, r),
      arithmeticSequence(start + 7, 1, 3).map(String),
      r,
    );
  },
  (t, r) => {
    const a = randomInt(2, 6, r);
    const b = randomInt(2, 6, r);
    const seq = [String(a), String(b), String(a), String(b), String(a), String(b)];
    return patternPuzzle(
      t,
      'repeating_pattern',
      'What is missing in the pattern?',
      seq,
      1,
      [String(a + b), String(a + 1), String(b + 1)],
      r,
    );
  },
];

// ---------------------------------------------------------------------------
// Tier 4 — Builder
// ---------------------------------------------------------------------------

const TIER4_DOORS: Template[] = [
  (t, r) => {
    const a = randomInt(11, 80, r);
    const b = randomInt(5, 100 - a, r);
    return numericDoorPuzzle(t, 'addition_within_100', `What is ${a} + ${b}?`, a + b, r, {
      max: 140,
      commonMistakes: [a + b + 10, a + b - 10, a + b + 1],
    });
  },
  (t, r) => {
    const a = randomInt(30, 100, r);
    const b = randomInt(5, a - 5, r);
    return numericDoorPuzzle(t, 'subtraction_within_100', `What is ${a} - ${b}?`, a - b, r, {
      max: 120,
      commonMistakes: [a - b + 10, a - b - 10, b - a > 0 ? b - a : a - b + 1],
    });
  },
  (t, r) => {
    const factor = pick([2, 5, 10], r);
    const n = randomInt(2, 12, r);
    return numericDoorPuzzle(
      t,
      'multiplication_intro',
      `What is ${n} x ${factor}?`,
      n * factor,
      r,
      { max: 160, commonMistakes: [n + factor, n * factor + factor, n * factor - factor] },
    );
  },
  (t, r) => {
    const hour = randomInt(1, 9, r);
    const add = randomInt(1, 3, r);
    const result = ((hour + add - 1) % 12) + 1;
    return numericDoorPuzzle(
      t,
      'time_hours',
      `It is ${hour} o'clock. What time will it be in ${add} hour${add > 1 ? 's' : ''}?`,
      result,
      r,
      { max: 12, commonMistakes: [hour, ((hour + add) % 12) + 1] },
    );
  },
  (t, r) => {
    const table: ReadonlyArray<[string, number, string]> = [
      ['centimeters are in 1 meter', 100, ''],
      ['millimeters are in 1 centimeter', 10, ''],
      ['minutes are in 1 hour', 60, ''],
      ['seconds are in 1 minute', 60, ''],
      ['hours are in 1 day', 24, ''],
      ['days are in 1 week', 7, ''],
      ['months are in 1 year', 12, ''],
      ['grams are in 1 kilogram', 1000, ''],
      ['meters are in 1 kilometer', 1000, ''],
      ['inches are in 1 foot', 12, ''],
    ];
    const [phrase, value] = pick(table, r);
    return numericDoorPuzzle(t, 'measurement', `How many ${phrase}?`, value, r, {
      max: value * 3,
      commonMistakes: [value * 10, value / 10, value + 10].filter((v) => Number.isInteger(v)),
    });
  },
];

const TIER4_DRAGS: Template[] = [
  (t, r) => {
    const values = shuffle(Array.from({ length: 99 }, (_, i) => i + 1), r).slice(0, 4).sort((a, b) => a - b);
    return orderingDragPuzzle(
      t,
      'number_ordering',
      'Drag the numbers into order, smallest first.',
      values.map(String),
      r,
    );
  },
  (t, r) => {
    const factor = pick([2, 5, 10], r);
    const start = randomInt(1, 5, r);
    return orderingDragPuzzle(
      t,
      'multiplication_intro',
      `Put the multiples of ${factor} in order.`,
      arithmeticSequence(start * factor, factor, 4).map(String),
      r,
    );
  },
  (t, r) => {
    const lengths: ReadonlyArray<[string, number]> = [
      ['1 cm', 1],
      ['10 cm', 10],
      ['50 cm', 50],
      ['1 m', 100],
      ['2 m', 200],
    ];
    const chosen = shuffle(lengths, r).slice(0, 4).sort((a, b) => a[1] - b[1]);
    return orderingDragPuzzle(
      t,
      'measurement',
      'Order these lengths from shortest to longest.',
      chosen.map(([label]) => label),
      r,
    );
  },
];

const TIER4_PATTERNS: Template[] = [
  (t, r) => {
    const factor = pick([2, 5, 10], r);
    const seq = arithmeticSequence(factor, factor, 6).map(String);
    return patternPuzzle(
      t,
      'multiplication_intro',
      `Fill in the missing multiples of ${factor}.`,
      seq,
      randomInt(1, 2, r),
      arithmeticSequence(factor * 7, factor, 3).map(String),
      r,
    );
  },
  (t, r) => {
    const start = randomInt(5, 40, r);
    const step = randomInt(3, 9, r);
    const seq = arithmeticSequence(start, step, 6).map(String);
    return patternPuzzle(
      t,
      'addition_within_100',
      `The pattern adds ${step} each time. Fill the blanks.`,
      seq,
      randomInt(1, 2, r),
      arithmeticSequence(start + 1, step, 3).map(String),
      r,
    );
  },
  (t, r) => {
    const start = randomInt(60, 99, r);
    const step = randomInt(3, 9, r);
    const seq = arithmeticSequence(start, -step, 6).map(String);
    return patternPuzzle(
      t,
      'subtraction_within_100',
      `The pattern subtracts ${step} each time. Fill the blanks.`,
      seq,
      randomInt(1, 2, r),
      arithmeticSequence(start - 1, -step, 3).map(String),
      r,
    );
  },
];

// ---------------------------------------------------------------------------
// Tier 5 — Navigator
// ---------------------------------------------------------------------------

const COINS: ReadonlyArray<[string, number]> = [
  ['penny', 1],
  ['nickel', 5],
  ['dime', 10],
  ['quarter', 25],
];

const TIER5_DOORS: Template[] = [
  (t, r) => {
    const a = randomInt(2, 10, r);
    const b = randomInt(2, 10, r);
    return numericDoorPuzzle(t, 'multiplication_facts', `What is ${a} x ${b}?`, a * b, r, {
      max: 130,
      commonMistakes: [a + b, a * b + a, a * b - b],
    });
  },
  (t, r) => {
    const b = randomInt(2, 10, r);
    const q = randomInt(2, 10, r);
    return numericDoorPuzzle(t, 'division_facts', `What is ${b * q} / ${b}?`, q, r, {
      max: 20,
      commonMistakes: [q + 1, q - 1, b],
    });
  },
  (t, r) => {
    const denominator = pick([2, 3, 4], r);
    const whole = denominator * randomInt(2, 6, r);
    const correct = whole / denominator;
    return numericDoorPuzzle(
      t,
      'fractions_intro',
      `What is 1/${denominator} of ${whole}?`,
      correct,
      r,
      { max: whole, commonMistakes: [whole - correct, correct + 1, denominator] },
    );
  },
  (t, r) => {
    const w = randomInt(2, 12, r);
    const h = randomInt(2, 12, r);
    return numericDoorPuzzle(
      t,
      'perimeter',
      `A rectangle is ${w} cm by ${h} cm. What is its perimeter?`,
      2 * (w + h),
      r,
      { max: 60, commonMistakes: [w * h, w + h, 2 * w + h], suffix: ' cm' },
    );
  },
  (t, r) => {
    const chosen = shuffle(COINS, r).slice(0, randomInt(2, 3, r));
    const total = chosen.reduce((sum, [, v]) => sum + v, 0);
    const names = chosen.map(([n]) => `a ${n}`).join(' and ');
    return numericDoorPuzzle(
      t,
      'money',
      `How many cents is ${names}?`,
      total,
      r,
      { max: 100, commonMistakes: [total + 5, total - 5, total + 10], suffix: 'c' },
    );
  },
];

const TIER5_DRAGS: Template[] = [
  (t, r) => {
    const fractions: Fraction[] = [
      { numerator: 1, denominator: 4 },
      { numerator: 1, denominator: 3 },
      { numerator: 1, denominator: 2 },
      { numerator: 2, denominator: 3 },
      { numerator: 3, denominator: 4 },
    ];
    const chosen = shuffle(fractions, r)
      .slice(0, 4)
      .sort((a, b) => a.numerator / a.denominator - b.numerator / b.denominator);
    return orderingDragPuzzle(
      t,
      'fractions_intro',
      'Order the fractions from smallest to largest.',
      chosen.map(formatFraction),
      r,
    );
  },
  (t, r) => {
    const chosen = shuffle(COINS, r).slice(0, 4).sort((a, b) => a[1] - b[1]);
    return orderingDragPuzzle(
      t,
      'money',
      'Order the coins from least to most valuable.',
      chosen.map(([name]) => name),
      r,
    );
  },
  (t, r) => {
    const factor = randomInt(3, 9, r);
    const starts = shuffle([2, 3, 4, 5, 6, 7], r).slice(0, 4).sort((a, b) => a - b);
    return orderingDragPuzzle(
      t,
      'multiplication_facts',
      `Order these products from smallest to largest.`,
      starts.map((n) => `${n} x ${factor}`),
      r,
    );
  },
];

const TIER5_PATTERNS: Template[] = [
  (t, r) => {
    const factor = randomInt(3, 9, r);
    const seq = arithmeticSequence(factor, factor, 6).map(String);
    return patternPuzzle(
      t,
      'multiplication_facts',
      `Fill in the missing multiples of ${factor}.`,
      seq,
      randomInt(1, 2, r),
      arithmeticSequence(factor * 7, factor, 3).map(String),
      r,
    );
  },
  (t, r) => {
    const denominator = pick([2, 3, 4, 5], r);
    const seq = Array.from({ length: 5 }, (_, i) =>
      formatFraction({ numerator: i + 1, denominator }),
    );
    return patternPuzzle(
      t,
      'fractions_intro',
      `Fill in the missing fractions (counting by 1/${denominator}).`,
      seq,
      randomInt(1, 2, r),
      [
        formatFraction({ numerator: 1, denominator: denominator + 1 }),
        formatFraction({ numerator: 7, denominator }),
        formatFraction({ numerator: 9, denominator }),
      ],
      r,
    );
  },
  (t, r) => {
    const start = randomInt(1, 4, r) * 25;
    const seq = arithmeticSequence(start, 25, 6).map((n) => `${n}c`);
    return patternPuzzle(
      t,
      'money',
      'Fill in the missing amounts (counting by 25c).',
      seq,
      randomInt(1, 2, r),
      [`${start + 10}c`, `${start + 5}c`, `${start + 175}c`],
      r,
    );
  },
];

// ---------------------------------------------------------------------------
// Tier 6 — Engineer
// ---------------------------------------------------------------------------

const TIER6_DOORS: Template[] = [
  (t, r) => {
    const a = randomInt(120, 899, r);
    const b = randomInt(120, 899, r);
    return numericDoorPuzzle(t, 'multi_digit_addition', `What is ${a} + ${b}?`, a + b, r, {
      commonMistakes: [a + b + 100, a + b - 100, a + b + 10],
    });
  },
  (t, r) => {
    const a = randomInt(300, 999, r);
    const b = randomInt(100, a - 50, r);
    return numericDoorPuzzle(t, 'multi_digit_subtraction', `What is ${a} - ${b}?`, a - b, r, {
      commonMistakes: [a - b + 100, a - b - 100, a - b + 10],
    });
  },
  (t, r) => {
    const a = randomInt(12, 99, r);
    const b = randomInt(3, 9, r);
    return numericDoorPuzzle(t, 'long_multiplication', `What is ${a} x ${b}?`, a * b, r, {
      commonMistakes: [a * b + b, a * b - b, Math.floor(a / 10) * b * 10 + (a % 10)],
    });
  },
  (t, r) => {
    const base: Fraction = pick(
      [
        { numerator: 1, denominator: 2 },
        { numerator: 1, denominator: 3 },
        { numerator: 2, denominator: 3 },
        { numerator: 1, denominator: 4 },
        { numerator: 3, denominator: 4 },
      ],
      r,
    );
    const factor = randomInt(2, 5, r);
    const equivalent: Fraction = {
      numerator: base.numerator * factor,
      denominator: base.denominator * factor,
    };
    const wrongs = generateFractionDistractors(equivalent, doorCount(t) - 1, r);
    return doorPuzzle(
      t,
      'equivalent_fractions',
      `Which fraction is equal to ${formatFraction(base)}?`,
      formatFraction(equivalent),
      wrongs.map(formatFraction),
      r,
    );
  },
  (t, r) => {
    const w = randomInt(3, 15, r);
    const h = randomInt(3, 15, r);
    return numericDoorPuzzle(
      t,
      'area',
      `A rectangle is ${w} cm by ${h} cm. What is its area?`,
      w * h,
      r,
      { commonMistakes: [2 * (w + h), w + h, w * h + w], suffix: ' sq cm' },
    );
  },
  (t, r) => {
    const n = randomInt(105, 989, r);
    const to = pick([10, 100], r);
    const correct = Math.round(n / to) * to;
    return numericDoorPuzzle(
      t,
      'rounding',
      `Round ${n} to the nearest ${to}.`,
      correct,
      r,
      { commonMistakes: [correct + to, correct - to, Math.floor(n / to) * to] },
    );
  },
  (t, r) => {
    const bars: ReadonlyArray<[string, number]> = [
      ['Monday', randomInt(2, 20, r)],
      ['Tuesday', randomInt(2, 20, r)],
      ['Wednesday', randomInt(2, 20, r)],
    ];
    const ask = pick(['most', 'total'] as const, r);
    const chart = bars.map(([d, v]) => `${d}: ${v}`).join(' | ');
    if (ask === 'total') {
      const total = bars.reduce((s, [, v]) => s + v, 0);
      return numericDoorPuzzle(
        t,
        'bar_graphs',
        `Bolts collected -- ${chart}. How many in total?`,
        total,
        r,
        { commonMistakes: [total + 1, total - 1] },
      );
    }
    const best = bars.reduce((a, b) => (b[1] > a[1] ? b : a));
    return numericDoorPuzzle(
      t,
      'bar_graphs',
      `Bolts collected -- ${chart}. How many on the busiest day?`,
      best[1],
      r,
      { commonMistakes: bars.map(([, v]) => v) },
    );
  },
];

const TIER6_DRAGS: Template[] = [
  (t, r) => {
    const values = shuffle(Array.from({ length: 40 }, () => randomInt(100, 9999, r)), r)
      .slice(0, 4)
      .sort((a, b) => a - b);
    return orderingDragPuzzle(
      t,
      'multi_digit_ordering',
      'Drag the numbers into order, smallest first.',
      values.map(String),
      r,
    );
  },
  (t, r) => {
    const rects = Array.from({ length: 4 }, () => {
      const w = randomInt(2, 12, r);
      const h = randomInt(2, 12, r);
      return { label: `${w} x ${h}`, area: w * h };
    }).sort((a, b) => a.area - b.area);
    return orderingDragPuzzle(
      t,
      'area',
      'Order the rectangles from smallest area to largest.',
      rects.map((x) => x.label),
      r,
    );
  },
  (t, r) => {
    const fractions: Fraction[] = [
      { numerator: 1, denominator: 6 },
      { numerator: 1, denominator: 3 },
      { numerator: 1, denominator: 2 },
      { numerator: 5, denominator: 6 },
      { numerator: 2, denominator: 3 },
    ];
    const chosen = shuffle(fractions, r)
      .slice(0, 4)
      .sort((a, b) => a.numerator / a.denominator - b.numerator / b.denominator);
    return orderingDragPuzzle(
      t,
      'equivalent_fractions',
      'Order the fractions from smallest to largest.',
      chosen.map(formatFraction),
      r,
    );
  },
];

const TIER6_PATTERNS: Template[] = [
  (t, r) => {
    const step = pick([25, 50, 100], r);
    const seq = arithmeticSequence(step, step, 6).map(String);
    return patternPuzzle(
      t,
      'multi_digit_addition',
      `Fill in the missing numbers (counting by ${step}s).`,
      seq,
      randomInt(1, 2, r),
      arithmeticSequence(step * 7, step, 3).map(String),
      r,
    );
  },
  (t, r) => {
    const start = randomInt(200, 900, r);
    const step = randomInt(11, 40, r);
    const seq = arithmeticSequence(start, -step, 6).map(String);
    return patternPuzzle(
      t,
      'multi_digit_subtraction',
      `The pattern subtracts ${step} each time. Fill the blanks.`,
      seq,
      randomInt(1, 2, r),
      arithmeticSequence(start - 1, -step, 3).map(String),
      r,
    );
  },
  (t, r) => {
    const base = randomInt(2, 5, r);
    const seq = Array.from({ length: 5 }, (_, i) => String(base ** (i + 1)));
    return patternPuzzle(
      t,
      'long_multiplication',
      `Each number is ${base} times the one before. Fill the blanks.`,
      seq,
      1,
      [String(base ** 6), String(base * 7), String(base + 10)],
      r,
    );
  },
];

// ---------------------------------------------------------------------------
// Tier 7 — Commander
// ---------------------------------------------------------------------------

/** Renders `count` d-ths as a mixed number: 7 quarters -> "1 3/4", 8 -> "2". */
function formatMixed(count: number, denominator: number): string {
  const whole = Math.floor(count / denominator);
  const remainder = count % denominator;
  if (remainder === 0) return String(whole);
  if (whole === 0) return `${remainder}/${denominator}`;
  return `${whole} ${remainder}/${denominator}`;
}

const TIER7_DOORS: Template[] = [
  (t, r) => {
    const divisor = randomInt(3, 9, r);
    const quotient = randomInt(3, 12, r);
    const remainder = randomInt(1, divisor - 1, r);
    const dividend = divisor * quotient + remainder;
    const correct = `${quotient} r${remainder}`;
    const wrongs = [
      `${quotient + 1} r${remainder}`,
      `${quotient} r${(remainder % (divisor - 1)) + 1}`,
      `${quotient - 1} r${remainder}`,
    ]
      .filter((w) => w !== correct)
      .slice(0, doorCount(t) - 1);
    return doorPuzzle(
      t,
      'division_with_remainders',
      `What is ${dividend} / ${divisor}?`,
      correct,
      wrongs,
      r,
    );
  },
  (t, r) => {
    const denominator = randomInt(2, 6, r);
    const whole = randomInt(1, 5, r);
    const numerator = randomInt(1, denominator - 1, r);
    const improper = whole * denominator + numerator;
    const correct = `${whole} ${numerator}/${denominator}`;
    const wrongs = [
      `${whole + 1} ${numerator}/${denominator}`,
      `${whole} ${denominator}/${numerator}`,
      `${numerator} ${whole}/${denominator}`,
    ]
      .filter((w) => w !== correct)
      .slice(0, doorCount(t) - 1);
    return doorPuzzle(
      t,
      'mixed_numbers',
      `Write ${improper}/${denominator} as a mixed number.`,
      correct,
      wrongs,
      r,
    );
  },
  (t, r) => {
    const a = randomInt(10, 99, r) / 10;
    const b = randomInt(10, 99, r) / 10;
    const correct = Math.round((a + b) * 10) / 10;
    return numericDoorPuzzle(
      t,
      'decimals_intro',
      `What is ${a.toFixed(1)} + ${b.toFixed(1)}?`,
      correct,
      r,
      { decimals: 1, commonMistakes: [correct + 1, correct - 1, Math.round(a + b)] },
    );
  },
  (t, r) => {
    const a = randomInt(2, 9, r);
    const b = randomInt(2, 9, r);
    const c = randomInt(2, 9, r);
    const shape = pick(['a + b * c', '(a + b) * c', 'a * b - c'] as const, r);
    const prompt =
      shape === 'a + b * c'
        ? `What is ${a} + ${b} x ${c}?`
        : shape === '(a + b) * c'
          ? `What is (${a} + ${b}) x ${c}?`
          : `What is ${a} x ${b} - ${c}?`;
    const correct =
      shape === 'a + b * c' ? a + b * c : shape === '(a + b) * c' ? (a + b) * c : a * b - c;
    // The signature mistake is evaluating strictly left to right.
    const leftToRight =
      shape === 'a + b * c' ? (a + b) * c : shape === '(a + b) * c' ? a + b * c : a * (b - c);
    return numericDoorPuzzle(t, 'order_of_operations', prompt, correct, r, {
      commonMistakes: [leftToRight, correct + c, correct - c],
    });
  },
  (t, r) => {
    const x = randomInt(1, 9, r);
    const y = randomInt(1, 9, r);
    const ask = pick(['right', 'up'] as const, r);
    const correct = ask === 'right' ? x : y;
    return numericDoorPuzzle(
      t,
      'coordinates',
      `Wall-E is at (${x}, ${y}). How far ${ask === 'right' ? 'right' : 'up'} from (0, 0) is that?`,
      correct,
      r,
      { max: 12, commonMistakes: [ask === 'right' ? y : x, correct + 1, correct - 1] },
    );
  },
];

const TIER7_DRAGS: Template[] = [
  (t, r) => {
    const values = Array.from({ length: 4 }, () => randomInt(101, 999, r) / 100)
      .sort((a, b) => a - b);
    return orderingDragPuzzle(
      t,
      'decimals_intro',
      'Order the decimals from smallest to largest.',
      values.map((v) => v.toFixed(2)),
      r,
    );
  },
  (t, r) => {
    const denominator = randomInt(3, 6, r);
    // Build the labels first, then sort by their real value, so the target
    // order is never ambiguous to the player.
    const mixed = shuffle(
      Array.from({ length: 12 }, (_, i) => ({
        whole: Math.floor(i / (denominator - 1)) + 1,
        numerator: (i % (denominator - 1)) + 1,
      })),
      r,
    )
      .slice(0, 4)
      .sort((a, b) => a.whole - b.whole || a.numerator - b.numerator);
    return orderingDragPuzzle(
      t,
      'mixed_numbers',
      'Order the mixed numbers from smallest to largest.',
      mixed.map((m) => `${m.whole} ${m.numerator}/${denominator}`),
      r,
    );
  },
  (t, r) => {
    const divisor = randomInt(4, 7, r);
    // One value per remainder bucket, so no two items can tie.
    const remainders = shuffle(
      Array.from({ length: divisor - 1 }, (_, i) => i + 1),
      r,
    )
      .slice(0, 4)
      .sort((a, b) => a - b);
    const values = remainders.map((rem) => divisor * randomInt(2, 9, r) + rem);
    return orderingDragPuzzle(
      t,
      'division_with_remainders',
      `Order by remainder when divided by ${divisor}, smallest remainder first.`,
      values.map(String),
      r,
    );
  },
];

const TIER7_PATTERNS: Template[] = [
  (t, r) => {
    const start = randomInt(1, 30, r) / 10;
    const step = randomInt(1, 9, r) / 10;
    const seq = Array.from({ length: 5 }, (_, i) => (start + i * step).toFixed(1));
    return patternPuzzle(
      t,
      'decimals_intro',
      `The pattern adds ${step.toFixed(1)} each time. Fill the blanks.`,
      seq,
      randomInt(1, 2, r),
      Array.from({ length: 3 }, (_, i) => (start + (i + 6) * step).toFixed(1)),
      r,
    );
  },
  (t, r) => {
    const denominator = randomInt(3, 6, r);
    const seq = Array.from({ length: 5 }, (_, i) => formatMixed(i + denominator, denominator));
    return patternPuzzle(
      t,
      'mixed_numbers',
      `Fill the blanks. Each step adds 1/${denominator}.`,
      seq,
      1,
      [
        formatMixed(denominator * 3, denominator),
        `1 ${denominator}/${denominator}`,
        `0 1/${denominator}`,
      ],
      r,
    );
  },
  (t, r) => {
    const start = randomInt(2, 6, r);
    const step = randomInt(2, 6, r);
    const seq = Array.from({ length: 5 }, (_, i) => String(start + i * step));
    return patternPuzzle(
      t,
      'order_of_operations',
      `Each step adds ${step}. Fill the blanks.`,
      seq,
      randomInt(1, 2, r),
      [String(start + 6 * step), String(start - step), String(start * step)],
      r,
    );
  },
];

// ---------------------------------------------------------------------------
// Tier 8 — Captain
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

const TIER8_DOORS: Template[] = [
  (t, r) => {
    const denominator = pick([4, 6, 8, 10, 12], r);
    const a = randomInt(1, denominator - 2, r);
    const b = randomInt(1, denominator - a - 1, r);
    const raw: Fraction = { numerator: a + b, denominator };
    const correct = simplifyFraction(raw);
    const addAcross: Fraction = { numerator: a + b, denominator: denominator * 2 };
    const wrongs = generateFractionDistractors(correct, doorCount(t) - 1, r, [raw, addAcross]);
    return doorPuzzle(
      t,
      'fraction_operations',
      `What is ${a}/${denominator} + ${b}/${denominator}? (simplest form)`,
      formatFraction(correct),
      wrongs.map(formatFraction),
      r,
    );
  },
  (t, r) => {
    // Simplify the operands so the prompt never shows e.g. 2/4.
    const { numerator: n1, denominator: d1 } = simplifyFraction({
      numerator: randomInt(1, 5, r),
      denominator: randomInt(6, 9, r),
    });
    const { numerator: n2, denominator: d2 } = simplifyFraction({
      numerator: randomInt(1, 4, r),
      denominator: randomInt(5, 8, r),
    });
    const correct = simplifyFraction({ numerator: n1 * n2, denominator: d1 * d2 });
    const addedInstead = simplifyFraction({
      numerator: n1 * d2 + n2 * d1,
      denominator: d1 * d2,
    });
    const wrongs = generateFractionDistractors(correct, doorCount(t) - 1, r, [addedInstead]);
    return doorPuzzle(
      t,
      'fraction_operations',
      `What is ${n1}/${d1} x ${n2}/${d2}? (simplest form)`,
      formatFraction(correct),
      wrongs.map(formatFraction),
      r,
    );
  },
  (t, r) => {
    const a = randomInt(101, 999, r) / 100;
    const b = randomInt(2, 9, r);
    const correct = Math.round(a * b * 100) / 100;
    return numericDoorPuzzle(
      t,
      'decimal_operations',
      `What is ${a.toFixed(2)} x ${b}?`,
      correct,
      r,
      { decimals: 2, commonMistakes: [Math.round(a * b * 10) / 10, correct * 10, correct / 10] },
    );
  },
  (t, r) => {
    const l = randomInt(2, 12, r);
    const w = randomInt(2, 12, r);
    const h = randomInt(2, 12, r);
    return numericDoorPuzzle(
      t,
      'volume',
      `A box is ${l} x ${w} x ${h} cm. What is its volume?`,
      l * w * h,
      r,
      {
        commonMistakes: [l + w + h, 2 * (l * w + w * h + l * h), l * w],
        suffix: ' cu cm',
      },
    );
  },
  (t, r) => {
    const count = pick([4, 5], r);
    const values = Array.from({ length: count }, () => randomInt(2, 20, r));
    const sum = values.reduce((s, v) => s + v, 0);
    const useMean = sum % count === 0 && r() < 0.5;
    const list = values.join(', ');
    if (useMean) {
      const correct = sum / count;
      return numericDoorPuzzle(
        t,
        'data_mean_median',
        `What is the mean of ${list}?`,
        correct,
        r,
        { commonMistakes: [median(values), sum, correct + 1] },
      );
    }
    const correct = median(values);
    return numericDoorPuzzle(
      t,
      'data_mean_median',
      `What is the median of ${list}?`,
      correct,
      r,
      { decimals: Number.isInteger(correct) ? 0 : 1, commonMistakes: [Math.round(sum / count)] },
    );
  },
  (t, r) => {
    const x = randomInt(2, 12, r);
    const a = randomInt(2, 9, r);
    const b = randomInt(1, 20, r);
    const correct = a * x + b;
    return numericDoorPuzzle(
      t,
      'expression_evaluation',
      `If n = ${x}, what is ${a}n + ${b}?`,
      correct,
      r,
      { commonMistakes: [a + x + b, a * (x + b), correct - b] },
    );
  },
];

const TIER8_DRAGS: Template[] = [
  (t, r) => {
    const denominators = shuffle([2, 3, 4, 5, 6, 8], r).slice(0, 4);
    const fractions = denominators.map((d) => ({ numerator: 1, denominator: d }));
    const ordered = fractions.sort(
      (a, b) => a.numerator / a.denominator - b.numerator / b.denominator,
    );
    return orderingDragPuzzle(
      t,
      'fraction_operations',
      'Order the fractions from smallest to largest.',
      ordered.map(formatFraction),
      r,
    );
  },
  (t, r) => {
    const values = Array.from({ length: 4 }, () => randomInt(1, 9999, r) / 1000).sort(
      (a, b) => a - b,
    );
    return orderingDragPuzzle(
      t,
      'decimal_operations',
      'Order the decimals from smallest to largest.',
      values.map((v) => v.toFixed(3)),
      r,
    );
  },
  (t, r) => {
    const boxes = Array.from({ length: 4 }, () => {
      const l = randomInt(1, 8, r);
      const w = randomInt(1, 8, r);
      const h = randomInt(1, 8, r);
      return { label: `${l}x${w}x${h}`, volume: l * w * h };
    }).sort((a, b) => a.volume - b.volume);
    return orderingDragPuzzle(
      t,
      'volume',
      'Order the boxes from smallest volume to largest.',
      boxes.map((b) => b.label),
      r,
    );
  },
];

const TIER8_PATTERNS: Template[] = [
  (t, r) => {
    const denominator = pick([4, 6, 8], r);
    const seq = Array.from({ length: 5 }, (_, i) =>
      formatFraction({ numerator: (i + 1) * 2, denominator }),
    );
    return patternPuzzle(
      t,
      'fraction_operations',
      `Each step adds 2/${denominator}. Fill the blanks.`,
      seq,
      randomInt(1, 2, r),
      [
        formatFraction({ numerator: 1, denominator }),
        formatFraction({ numerator: 13, denominator }),
        formatFraction({ numerator: 3, denominator: denominator + 1 }),
      ],
      r,
    );
  },
  (t, r) => {
    const start = randomInt(1, 40, r) / 100;
    const step = randomInt(5, 40, r) / 100;
    const seq = Array.from({ length: 5 }, (_, i) => (start + i * step).toFixed(2));
    return patternPuzzle(
      t,
      'decimal_operations',
      `The pattern adds ${step.toFixed(2)} each time. Fill the blanks.`,
      seq,
      randomInt(1, 2, r),
      Array.from({ length: 3 }, (_, i) => (start + (i + 6) * step).toFixed(2)),
      r,
    );
  },
  (t, r) => {
    const a = randomInt(2, 6, r);
    const b = randomInt(1, 9, r);
    const seq = Array.from({ length: 5 }, (_, i) => String(a * (i + 1) + b));
    return patternPuzzle(
      t,
      'expression_evaluation',
      `This is ${a}n + ${b} for n = 1, 2, 3, ... Fill the blanks.`,
      seq,
      randomInt(1, 2, r),
      [String(a * 7 + b), String(a + b), String(a * 6 + b + 1)],
      r,
    );
  },
];

// ---------------------------------------------------------------------------
// Registry + public API
// ---------------------------------------------------------------------------

interface TierTemplates {
  door_selection: Template[];
  drag_and_drop: Template[];
  pattern_completion: Template[];
}

const TEMPLATES: Record<number, TierTemplates> = {
  3: { door_selection: TIER3_DOORS, drag_and_drop: TIER3_DRAGS, pattern_completion: TIER3_PATTERNS },
  4: { door_selection: TIER4_DOORS, drag_and_drop: TIER4_DRAGS, pattern_completion: TIER4_PATTERNS },
  5: { door_selection: TIER5_DOORS, drag_and_drop: TIER5_DRAGS, pattern_completion: TIER5_PATTERNS },
  6: { door_selection: TIER6_DOORS, drag_and_drop: TIER6_DRAGS, pattern_completion: TIER6_PATTERNS },
  7: { door_selection: TIER7_DOORS, drag_and_drop: TIER7_DRAGS, pattern_completion: TIER7_PATTERNS },
  8: { door_selection: TIER8_DOORS, drag_and_drop: TIER8_DRAGS, pattern_completion: TIER8_PATTERNS },
};

/** Tiers this module can generate content for. Tiers 1-2 are authored. */
export const PROCEDURAL_TIERS = Object.keys(TEMPLATES).map(Number);

/** PRD Section 12.1 — minimum viable content per tier. */
export const PUZZLES_PER_TIER: Record<PuzzleType, number> = {
  door_selection: 30,
  drag_and_drop: 15,
  pattern_completion: 15,
};

function padId(n: number): string {
  return String(n).padStart(3, '0');
}

const ID_PREFIX: Record<PuzzleType, string> = {
  door_selection: 'door',
  drag_and_drop: 'drag',
  pattern_completion: 'pattern',
};

/**
 * Generates `count` unique puzzles of one type for a tier. Uniqueness is keyed
 * on the prompt plus the answer, so two puzzles never read identically inside
 * a tier's pool.
 */
export function generatePuzzlesOfType(
  tierId: number,
  type: PuzzleType,
  count: number,
  random: RandomSource,
): Puzzle[] {
  const templates = TEMPLATES[tierId]?.[type];
  if (!templates || templates.length === 0) {
    throw new Error(`No ${type} templates registered for tier ${tierId}`);
  }

  const out: Puzzle[] = [];
  const seen = new Set<string>();
  let guard = 0;
  const maxAttempts = count * 200;

  while (out.length < count && guard < maxAttempts) {
    guard += 1;
    // Round-robin across attempts (not results) so every math topic gets a
    // fair share, while a template whose content space is exhausted simply
    // stops contributing instead of stalling the whole pool.
    const template = templates[guard % templates.length] as Template;
    const generated = template(tierId, random);
    const key = `${generated.prompt}::${answerKey(generated)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...generated, id: `t${tierId}-${ID_PREFIX[type]}-${padId(out.length + 1)}` });
  }

  if (out.length < count) {
    throw new Error(
      `Only generated ${out.length}/${count} unique ${type} puzzles for tier ${tierId}`,
    );
  }
  return out;
}

function answerKey(puzzle: GeneratedPuzzle): string {
  if (puzzle.options) return puzzle.options.filter((o) => o.isCorrect).map((o) => o.label).join(',');
  if (puzzle.draggableItems) {
    return puzzle.draggableItems
      .slice()
      .sort((a, b) => a.correctPosition - b.correctPosition)
      .map((i) => i.label)
      .join(',');
  }
  return (puzzle.correctFills ?? []).join(',');
}

/** Generates a tier's full pool (30 door / 15 drag / 15 pattern by default). */
export function generateTier(
  tierId: number,
  random: RandomSource,
  counts: Record<PuzzleType, number> = PUZZLES_PER_TIER,
): Puzzle[] {
  return [
    ...generatePuzzlesOfType(tierId, 'door_selection', counts.door_selection, random),
    ...generatePuzzlesOfType(tierId, 'drag_and_drop', counts.drag_and_drop, random),
    ...generatePuzzlesOfType(tierId, 'pattern_completion', counts.pattern_completion, random),
  ];
}
