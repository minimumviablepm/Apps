import type { Puzzle } from '@/types';
import { allPuzzles, getTierPuzzles } from '@/data/puzzleLoader';
import { PUZZLES_PER_TIER } from '@/utils/puzzleGenerator';
import { TIERS } from '@/data/tiers';

/**
 * PRD Section 12.1 requires 30 door / 15 drag / 15 pattern per tier, 480 in
 * total. These assertions run against the committed JSON, so a regenerated
 * pool that drifts fails the build rather than shipping.
 */
describe('puzzle pools', () => {
  it('ships 480 puzzles across 8 tiers', () => {
    expect(allPuzzles()).toHaveLength(480);
  });

  it.each(TIERS.map((t) => t.tierId))('tier %i has the required mix', (tierId) => {
    const pool = getTierPuzzles(tierId);
    expect(pool).toHaveLength(60);
    (Object.keys(PUZZLES_PER_TIER) as Array<keyof typeof PUZZLES_PER_TIER>).forEach((type) => {
      expect(pool.filter((p) => p.type === type)).toHaveLength(PUZZLES_PER_TIER[type]);
    });
  });

  it('gives every puzzle a unique id', () => {
    const ids = allPuzzles().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never repeats a question inside a tier', () => {
    // A prompt alone is not a puzzle's identity: "Put the numbers in order."
    // and "Which pile has MORE?" are reused with different content. What must
    // never repeat is the prompt together with the question it actually asks.
    const signature = (p: Puzzle) => {
      if (p.type === 'door_selection') {
        return `${p.prompt}::${p.options?.find((o) => o.isCorrect)?.label ?? ''}`;
      }
      if (p.type === 'drag_and_drop') {
        return `${p.prompt}::${(p.draggableItems ?? [])
          .slice()
          .sort((a, b) => a.correctPosition - b.correctPosition)
          .map((i) => i.label)
          .join(',')}`;
      }
      return `${p.prompt}::${(p.sequence ?? [])
        .map((c) => `${c.isBlank ? '_' : ''}${c.value}`)
        .join(',')}`;
    };

    TIERS.forEach(({ tierId }) => {
      const pool = getTierPuzzles(tierId);
      expect(new Set(pool.map(signature)).size).toBe(pool.length);
    });
  });
});

describe('puzzle shape', () => {
  const pool = allPuzzles();

  it('gives door puzzles 3-4 options with exactly one correct', () => {
    pool
      .filter((p) => p.type === 'door_selection')
      .forEach((p) => {
        const options = p.options ?? [];
        expect(options.length).toBeGreaterThanOrEqual(3);
        expect(options.length).toBeLessThanOrEqual(4);
        expect(options.filter((o) => o.isCorrect)).toHaveLength(1);
        expect(new Set(options.map((o) => o.label)).size).toBe(options.length);
        options.forEach((o) => expect(o.label.trim()).not.toBe(''));
      });
  });

  it('gives drag puzzles a contiguous, unambiguous target order', () => {
    pool
      .filter((p) => p.type === 'drag_and_drop')
      .forEach((p) => {
        const items = p.draggableItems ?? [];
        expect(items.length).toBeGreaterThanOrEqual(3);
        const positions = items.map((i) => i.correctPosition).sort((a, b) => a - b);
        expect(positions).toEqual(items.map((_, i) => i));
        expect(new Set(items.map((i) => i.label)).size).toBe(items.length);
        expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
      });
  });

  it('gives pattern puzzles 1-2 answerable blanks', () => {
    pool
      .filter((p) => p.type === 'pattern_completion')
      .forEach((p) => {
        const sequence = p.sequence ?? [];
        const blanks = sequence.filter((c) => c.isBlank);
        expect(blanks.length).toBeGreaterThanOrEqual(1);
        expect(blanks.length).toBeLessThanOrEqual(2);
        expect(sequence[0]?.isBlank).toBe(false);
        expect(p.correctFills ?? []).toHaveLength(blanks.length);
        (p.correctFills ?? []).forEach((fill) => expect(p.fillOptions ?? []).toContain(fill));
        // The tray must offer more than just the answers.
        expect((p.fillOptions ?? []).length).toBeGreaterThan(blanks.length);
      });
  });

  it('stamps every puzzle with its own tier and a math topic', () => {
    TIERS.forEach(({ tierId, topics }) => {
      getTierPuzzles(tierId).forEach((p) => {
        expect(p.tierId).toBe(tierId);
        expect(p.mathTopic).toBeTruthy();
        expect(p.prompt.trim()).not.toBe('');
        void topics;
      });
    });
  });
});

/**
 * Independent verification: re-derive the answer straight from the prompt text
 * and compare it against the door marked correct. This catches a template that
 * builds a prompt one way and an answer another.
 */
describe('door answers agree with their prompts', () => {
  const correctLabel = (p: Puzzle) => p.options?.find((o) => o.isCorrect)?.label ?? '';
  const num = (label: string) => Number(label.replace(/[^0-9.-]/g, ''));

  const checks: Array<[RegExp, (m: RegExpMatchArray) => number]> = [
    [/^What is (\d+) \+ (\d+)\?$/, (m) => Number(m[1]) + Number(m[2])],
    [/^What is (\d+) - (\d+)\?$/, (m) => Number(m[1]) - Number(m[2])],
    [/^What is (\d+) x (\d+)\?$/, (m) => Number(m[1]) * Number(m[2])],
    [/^What is (\d+) \/ (\d+)\?$/, (m) => Number(m[1]) / Number(m[2])],
    [/^What is (\d+) \+ (\d+) x (\d+)\?$/, (m) => Number(m[1]) + Number(m[2]) * Number(m[3])],
    [/^What is \((\d+) \+ (\d+)\) x (\d+)\?$/, (m) => (Number(m[1]) + Number(m[2])) * Number(m[3])],
    [/^What is (\d+) x (\d+) - (\d+)\?$/, (m) => Number(m[1]) * Number(m[2]) - Number(m[3])],
    [
      /^A rectangle is (\d+) cm by (\d+) cm\. What is its perimeter\?$/,
      (m) => 2 * (Number(m[1]) + Number(m[2])),
    ],
    [
      /^A rectangle is (\d+) cm by (\d+) cm\. What is its area\?$/,
      (m) => Number(m[1]) * Number(m[2]),
    ],
    [
      /^A box is (\d+) x (\d+) x (\d+) cm\. What is its volume\?$/,
      (m) => Number(m[1]) * Number(m[2]) * Number(m[3]),
    ],
    [/^If n = (\d+), what is (\d+)n \+ (\d+)\?$/, (m) => Number(m[2]) * Number(m[1]) + Number(m[3])],
    [/^Round (\d+) to the nearest (\d+)\.$/, (m) => Math.round(Number(m[1]) / Number(m[2])) * Number(m[2])],
    [/^What is 1\/(\d+) of (\d+)\?$/, (m) => Number(m[2]) / Number(m[1])],
    [/^How many (tens) are in (\d+)\?$/, (m) => Math.floor(Number(m[2]) / 10)],
    [/^How many (ones) are in (\d+)\?$/, (m) => Number(m[2]) % 10],
    [
      /^What is (\d+\.\d) \+ (\d+\.\d)\?$/,
      (m) => Math.round((Number(m[1]) + Number(m[2])) * 10) / 10,
    ],
    [
      /^What is (\d+\.\d\d) x (\d+)\?$/,
      (m) => Math.round(Number(m[1]) * Number(m[2]) * 100) / 100,
    ],
  ];

  it('recomputes every recognisable arithmetic prompt', () => {
    let verified = 0;
    allPuzzles()
      .filter((p) => p.type === 'door_selection')
      .forEach((puzzle) => {
        // Remainder division shares the "a / b" prompt shape but answers
        // "q rN"; it gets its own check below.
        if (puzzle.mathTopic === 'division_with_remainders') return;
        for (const [pattern, compute] of checks) {
          const match = puzzle.prompt.match(pattern);
          if (!match) continue;
          const expected = compute(match);
          expect({ prompt: puzzle.prompt, answer: num(correctLabel(puzzle)) }).toEqual({
            prompt: puzzle.prompt,
            answer: expected,
          });
          verified += 1;
          break;
        }
      });
    // Guard against the regexes silently matching nothing.
    expect(verified).toBeGreaterThan(100);
  });

  it('checks mixed-number conversions', () => {
    allPuzzles()
      .filter((p) => /^Write (\d+)\/(\d+) as a mixed number\.$/.test(p.prompt))
      .forEach((puzzle) => {
        const [, n, d] = puzzle.prompt.match(/^Write (\d+)\/(\d+) as a mixed number\.$/) as string[];
        const whole = Math.floor(Number(n) / Number(d));
        const rest = Number(n) % Number(d);
        const expected = rest === 0 ? String(whole) : `${whole} ${rest}/${d}`;
        expect(correctLabel(puzzle)).toBe(expected);
      });
  });

  it('checks division with remainders', () => {
    allPuzzles()
      .filter((p) => p.mathTopic === 'division_with_remainders' && p.type === 'door_selection')
      .forEach((puzzle) => {
        const match = puzzle.prompt.match(/^What is (\d+) \/ (\d+)\?$/);
        if (!match) return;
        const dividend = Number(match[1]);
        const divisor = Number(match[2]);
        expect(correctLabel(puzzle)).toBe(
          `${Math.floor(dividend / divisor)} r${dividend % divisor}`,
        );
      });
  });
});

describe('pattern sequences are internally consistent', () => {
  it('follows an arithmetic, geometric or repeating rule', () => {
    allPuzzles()
      .filter((p) => p.type === 'pattern_completion')
      .forEach((puzzle) => {
        const values = (puzzle.sequence ?? []).map((c) => c.value);
        if (!values.every((v) => /^-?\d+(\.\d+)?$/.test(v))) return;
        const numbers = values.map(Number);
        const step = Math.round(((numbers[1] as number) - (numbers[0] as number)) * 1000) / 1000;
        const isArithmetic = numbers.every(
          (v, i) => i === 0 || Math.abs(v - (numbers[i - 1] as number) - step) < 1e-6,
        );
        const isGeometric =
          (numbers[0] as number) !== 0 &&
          numbers.every((v, i) => {
            if (i === 0) return true;
            const ratio = (numbers[1] as number) / (numbers[0] as number);
            return Math.abs(v - (numbers[i - 1] as number) * ratio) < 1e-6;
          });
        // Tier 3 also uses simple repeating patterns (4, 2, 4, 2, ...).
        const isPeriodic = (() => {
          for (let period = 1; period < numbers.length; period += 1) {
            let matches = true;
            for (let i = period; i < numbers.length; i += 1) {
              if (numbers[i] !== numbers[i - period]) {
                matches = false;
                break;
              }
            }
            if (matches && numbers.length >= period * 2) return true;
          }
          return false;
        })();

        expect({ id: puzzle.id, ok: isArithmetic || isGeometric || isPeriodic }).toEqual({
          id: puzzle.id,
          ok: true,
        });
      });
  });
});
