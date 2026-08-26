import type { CharacterConfig, CharacterId, WrongAnswerCharacterId } from '@/types';

/**
 * PRD Section 7 — Character roster.
 *
 * `color` drives the placeholder sprite (PRD Section 19.8: colored rectangles
 * with name labels). Dropping real sprite sheets in later means adding a
 * `sprite` field here and reading it in components/characters/Sprite.tsx.
 */
export const CHARACTERS: Record<CharacterId, CharacterConfig> = {
  walle: {
    id: 'walle',
    name: 'Wall-E',
    color: '#D9A441',
    textColor: '#2C1A08',
    reactions: ["Let's find Eve!"],
    soundKey: 'walle_beep',
  },
  eve: {
    id: 'eve',
    name: 'Eve',
    color: '#EFF6F5',
    textColor: '#12433C',
    reactions: ['Wall-E!', 'You found me!', 'Great job!'],
    soundKey: 'correct',
  },
  mo: {
    id: 'mo',
    name: 'M-O',
    color: '#F2F0E6',
    textColor: '#1F3A5F',
    reactions: ['Dirty! Dirty!', 'Not here!', 'Clean up!'],
    soundKey: 'mo_scrub',
    weight: 40,
  },
  auto: {
    id: 'auto',
    name: 'AUTO',
    color: '#3A3F47',
    textColor: '#FF4D4D',
    reactions: ['Directive not met.', 'Incorrect.', 'Try again, Captain.'],
    soundKey: 'auto_buzz',
    weight: 25,
  },
  vaqm: {
    id: 'vaqm',
    name: 'VaQ-M',
    color: '#8C6239',
    textColor: '#FFF3DC',
    reactions: ['Beep boop!', 'Wrong way!'],
    soundKey: 'bot_clunk',
    // Reject bots share 35% split evenly (PRD Section 7.2).
    weight: 35 / 3,
  },
  dfib: {
    id: 'dfib',
    name: 'D-FIB',
    color: '#B34747',
    textColor: '#FFF0F0',
    reactions: ['Not today!', 'Oops!'],
    soundKey: 'bot_spring',
    weight: 35 / 3,
  },
  brla: {
    id: 'brla',
    name: 'BRL-A',
    color: '#6A5AA8',
    textColor: '#F3EEFF',
    reactions: ['Hehe, nope!', 'Over here... wait, no.'],
    soundKey: 'bot_umbrella',
    weight: 35 / 3,
  },
};

export const WRONG_ANSWER_CHARACTER_IDS: WrongAnswerCharacterId[] = [
  'mo',
  'auto',
  'vaqm',
  'dfib',
  'brla',
];

export function getCharacter(id: CharacterId): CharacterConfig {
  return CHARACTERS[id];
}

/** Deterministic-friendly random source so tests can pin the outcome. */
export type RandomSource = () => number;

/**
 * Weighted random wrong-answer character (PRD Section 7.2).
 * `previousId` is excluded so no character repeats on consecutive wrong
 * answers within the same round.
 */
export function pickWrongAnswerCharacter(
  previousId: WrongAnswerCharacterId | null = null,
  random: RandomSource = Math.random,
): WrongAnswerCharacterId {
  const pool = WRONG_ANSWER_CHARACTER_IDS.filter((id) => id !== previousId);
  const totalWeight = pool.reduce((sum, id) => sum + (CHARACTERS[id].weight ?? 0), 0);
  let roll = random() * totalWeight;
  for (const id of pool) {
    roll -= CHARACTERS[id].weight ?? 0;
    if (roll <= 0) return id;
  }
  return pool[pool.length - 1] as WrongAnswerCharacterId;
}

/** Picks a reaction line for a character, avoiding an immediate repeat. */
export function pickReaction(
  id: CharacterId,
  previousLine: string | null = null,
  random: RandomSource = Math.random,
): string {
  const lines = CHARACTERS[id].reactions;
  const pool = lines.length > 1 ? lines.filter((line) => line !== previousLine) : lines;
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[index] as string;
}
