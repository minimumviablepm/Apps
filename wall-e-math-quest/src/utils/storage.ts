import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GameState, PlayerProfile } from '@/types';
import { TIERS } from '@/data/tiers';
import { ROUND_HISTORY_LIMIT, emptyTierProgress } from './progressionEngine';

export const STORAGE_KEY = 'walle-math-quest:game-state:v1';

/** PRD Section 10, Screen 1 — name is capped at 20 characters. */
export const MAX_NAME_LENGTH = 20;

export class StorageReadError extends Error {}
export class StorageWriteError extends Error {}

/**
 * Coerces whatever came back from AsyncStorage into a valid GameState.
 *
 * Anything missing or malformed is repaired rather than rejected — a player
 * losing their progress to a schema drift is worse than a slightly stale
 * field. Returns null only when the payload has no usable profile at all,
 * which the caller surfaces as the "Start Fresh" error state.
 */
export function parseGameState(raw: string | null): GameState | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new StorageReadError('Stored game state is not valid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new StorageReadError('Stored game state is not an object');
  }

  const candidate = parsed as Partial<GameState>;
  const profile = candidate.profile;
  if (
    !profile ||
    typeof profile.id !== 'string' ||
    typeof profile.name !== 'string' ||
    typeof profile.age !== 'number'
  ) {
    throw new StorageReadError('Stored game state has no usable profile');
  }

  const storedTiers = Array.isArray(candidate.tiers) ? candidate.tiers : [];
  const tiers = TIERS.map((tier) => {
    const found = storedTiers.find((t) => t?.tierId === tier.tierId);
    const base = emptyTierProgress(tier.tierId, tier.tierId === 1);
    if (!found) return base;
    return {
      ...base,
      ...found,
      tierId: tier.tierId,
      isUnlocked: Boolean(found.isUnlocked) || tier.tierId === 1,
    };
  });

  const roundHistory = Array.isArray(candidate.roundHistory)
    ? candidate.roundHistory.slice(-ROUND_HISTORY_LIMIT)
    : [];

  return {
    profile: {
      id: profile.id,
      name: profile.name.slice(0, MAX_NAME_LENGTH),
      age: profile.age,
      createdAt: typeof profile.createdAt === 'string' ? profile.createdAt : new Date(0).toISOString(),
    } satisfies PlayerProfile,
    tiers,
    roundHistory,
    settings: {
      soundEnabled: candidate.settings?.soundEnabled ?? true,
      musicEnabled: candidate.settings?.musicEnabled ?? true,
    },
  };
}

export async function loadGameState(): Promise<GameState | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch (error) {
    throw new StorageReadError(`AsyncStorage read failed: ${String(error)}`);
  }
  return parseGameState(raw);
}

/**
 * PRD Section 15 — a failed write is retried once before the caller shows the
 * "Progress might not have saved." warning.
 */
export async function saveGameState(state: GameState): Promise<void> {
  const payload = JSON.stringify(state);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, payload);
    return;
  } catch {
    // fall through to the single retry
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, payload);
  } catch (error) {
    throw new StorageWriteError(`AsyncStorage write failed twice: ${String(error)}`);
  }
}

export async function clearGameState(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/** RFC4122-ish v4 id. Avoids pulling a polyfilled crypto into the RN runtime. */
export function createId(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex.charAt(8 + Math.floor(Math.random() * 4));
    else out += hex.charAt(Math.floor(Math.random() * 16));
  }
  return out;
}
