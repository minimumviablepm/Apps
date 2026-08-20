import { CHARACTERS, WRONG_ANSWER_CHARACTER_IDS, pickReaction, pickWrongAnswerCharacter } from '@/data/characters';
import { seededRandom } from '@/utils/random';

describe('wrong-answer character selection (PRD Section 7.2)', () => {
  it('roughly matches the published weights over many draws', () => {
    const random = seededRandom(42);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 20_000; i += 1) {
      const id = pickWrongAnswerCharacter(null, random);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(counts.mo / 20_000).toBeCloseTo(0.4, 1);
    expect(counts.auto / 20_000).toBeCloseTo(0.25, 1);
    const rejects = (counts.vaqm + counts.dfib + counts.brla) / 20_000;
    expect(rejects).toBeCloseTo(0.35, 1);
  });

  it('never repeats the previous character', () => {
    const random = seededRandom(7);
    let previous = pickWrongAnswerCharacter(null, random);
    for (let i = 0; i < 2_000; i += 1) {
      const next = pickWrongAnswerCharacter(previous, random);
      expect(next).not.toBe(previous);
      previous = next;
    }
  });

  it('covers the whole roster', () => {
    expect(WRONG_ANSWER_CHARACTER_IDS).toHaveLength(5);
    WRONG_ANSWER_CHARACTER_IDS.forEach((id) => {
      expect(CHARACTERS[id].reactions.length).toBeGreaterThan(0);
      expect(CHARACTERS[id].weight).toBeGreaterThan(0);
    });
  });
});

describe('reaction lines', () => {
  it('avoids repeating the previous line when there is an alternative', () => {
    const random = seededRandom(3);
    for (let i = 0; i < 200; i += 1) {
      expect(pickReaction('eve', 'Wall-E!', random)).not.toBe('Wall-E!');
    }
  });

  it('still returns a line when the character only knows one', () => {
    expect(pickReaction('walle', "Let's find Eve!")).toBe("Let's find Eve!");
  });
});
