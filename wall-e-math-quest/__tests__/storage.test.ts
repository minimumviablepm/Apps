import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  STORAGE_KEY,
  StorageReadError,
  StorageWriteError,
  clearGameState,
  createId,
  loadGameState,
  parseGameState,
  saveGameState,
} from '@/utils/storage';
import { initialGameState, applyRoundResult } from '@/utils/progressionEngine';
import type { PlayerProfile, RoundResult } from '@/types';

const profile: PlayerProfile = {
  id: 'abc',
  name: 'Wall-E Fan',
  age: 7,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const round: RoundResult = {
  tierId: 4,
  timestamp: '2026-01-02T00:00:00.000Z',
  score: 8,
  totalPuzzles: 10,
  percentage: 80,
  durationMs: 60_000,
  puzzleBreakdown: {
    doorSelection: { attempted: 5, correct: 4 },
    dragAndDrop: { attempted: 3, correct: 3 },
    patternCompletion: { attempted: 2, correct: 1 },
  },
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('AC-8: progress survives a relaunch', () => {
  it('round-trips tier progress, best scores and star ratings', async () => {
    const fresh = initialGameState(profile);
    const played = applyRoundResult(fresh, round).state;
    await saveGameState(played);

    const reloaded = await loadGameState();
    expect(reloaded).not.toBeNull();
    expect(reloaded?.profile).toEqual(played.profile);
    expect(reloaded?.tiers.find((t) => t.tierId === 4)).toEqual(
      played.tiers.find((t) => t.tierId === 4),
    );
    expect(reloaded?.roundHistory).toHaveLength(1);
  });

  it('returns null when nothing has been stored yet', async () => {
    await expect(loadGameState()).resolves.toBeNull();
  });
});

describe('AC-10: reset clears everything', () => {
  it('removes the stored state', async () => {
    await saveGameState(initialGameState(profile));
    await clearGameState();
    await expect(AsyncStorage.getItem(STORAGE_KEY)).resolves.toBeNull();
    await expect(loadGameState()).resolves.toBeNull();
  });
});

describe('parseGameState repairs and rejects', () => {
  it('throws on malformed JSON so the caller can offer "Start Fresh"', () => {
    expect(() => parseGameState('{ not json')).toThrow(StorageReadError);
  });

  it('throws when the profile is unusable', () => {
    expect(() => parseGameState(JSON.stringify({ tiers: [] }))).toThrow(StorageReadError);
  });

  it('rebuilds a missing tier array with tier 1 unlocked', () => {
    const parsed = parseGameState(JSON.stringify({ profile }));
    expect(parsed?.tiers).toHaveLength(8);
    expect(parsed?.tiers[0]?.isUnlocked).toBe(true);
    expect(parsed?.tiers[1]?.isUnlocked).toBe(false);
  });

  it('fills in missing settings with sound and music on', () => {
    const parsed = parseGameState(JSON.stringify({ profile }));
    expect(parsed?.settings).toEqual({ soundEnabled: true, musicEnabled: true });
  });

  it('truncates an over-long stored name to 20 characters', () => {
    const parsed = parseGameState(
      JSON.stringify({ profile: { ...profile, name: 'x'.repeat(50) } }),
    );
    expect(parsed?.profile.name).toHaveLength(20);
  });

  it('trims a bloated round history back to the last 50', () => {
    const history = Array.from({ length: 80 }, (_, i) => ({ ...round, timestamp: `t${i}` }));
    const parsed = parseGameState(JSON.stringify({ profile, roundHistory: history }));
    expect(parsed?.roundHistory).toHaveLength(50);
    expect(parsed?.roundHistory[0]?.timestamp).toBe('t30');
  });
});

describe('save failures (PRD Section 15)', () => {
  it('retries once and succeeds', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce(undefined);

    await expect(saveGameState(initialGameState(profile))).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('surfaces a write error after the retry also fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('disk full'));
    await expect(saveGameState(initialGameState(profile))).rejects.toBeInstanceOf(StorageWriteError);
  });

  it('surfaces a read error rather than silently starting over', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('unreadable'));
    await expect(loadGameState()).rejects.toBeInstanceOf(StorageReadError);
  });
});

describe('createId', () => {
  it('produces unique v4-shaped ids', () => {
    const ids = new Set(Array.from({ length: 500 }, createId));
    expect(ids.size).toBe(500);
    ids.forEach((id) =>
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
    );
  });
});
