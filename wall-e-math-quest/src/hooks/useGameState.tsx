import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { GameSettings, GameState, PlayerProfile, RoundResult } from '@/types';
import { initialGameState, applyRoundResult, type ApplyRoundOutcome } from '@/utils/progressionEngine';
import {
  MAX_NAME_LENGTH,
  clearGameState,
  createId,
  loadGameState,
  saveGameState,
} from '@/utils/storage';

export type GameStatus = 'loading' | 'no-profile' | 'ready' | 'load-error';

interface GameStateContextValue {
  status: GameStatus;
  state: GameState | null;
  /** True when the most recent save failed twice (PRD Section 15). */
  saveWarning: boolean;
  createProfile: (name: string, age: number) => Promise<void>;
  /** Folds a finished round in and persists. Returns what changed. */
  recordRound: (result: RoundResult) => Promise<ApplyRoundOutcome>;
  updateSettings: (patch: Partial<GameSettings>) => Promise<void>;
  renamePlayer: (name: string) => Promise<void>;
  resetProgress: () => Promise<void>;
  /** Re-initialises after an unrecoverable read error ("Start Fresh"). */
  startFresh: () => void;
}

const GameStateContext = createContext<GameStateContextValue | null>(null);

export function GameStateProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<GameStatus>('loading');
  const [state, setState] = useState<GameState | null>(null);
  const [saveWarning, setSaveWarning] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const loaded = await loadGameState();
        if (!mounted.current) return;
        if (loaded) {
          setState(loaded);
          setStatus('ready');
        } else {
          setStatus('no-profile');
        }
      } catch {
        if (!mounted.current) return;
        setStatus('load-error');
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Single funnel for "mutate then persist", so the warning flag is consistent. */
  const persist = useCallback(async (next: GameState) => {
    setState(next);
    try {
      await saveGameState(next);
      setSaveWarning(false);
    } catch {
      setSaveWarning(true);
    }
  }, []);

  const createProfile = useCallback(
    async (name: string, age: number) => {
      const profile: PlayerProfile = {
        id: createId(),
        name: name.trim().slice(0, MAX_NAME_LENGTH),
        age,
        createdAt: new Date().toISOString(),
      };
      const next = initialGameState(profile);
      setStatus('ready');
      await persist(next);
    },
    [persist],
  );

  const recordRound = useCallback(
    async (result: RoundResult): Promise<ApplyRoundOutcome> => {
      const current = state;
      if (!current) throw new Error('recordRound called before the profile was loaded');
      const outcome = applyRoundResult(current, result);
      await persist(outcome.state);
      return outcome;
    },
    [state, persist],
  );

  const updateSettings = useCallback(
    async (patch: Partial<GameSettings>) => {
      if (!state) return;
      await persist({ ...state, settings: { ...state.settings, ...patch } });
    },
    [state, persist],
  );

  const renamePlayer = useCallback(
    async (name: string) => {
      if (!state) return;
      await persist({
        ...state,
        profile: { ...state.profile, name: name.trim().slice(0, MAX_NAME_LENGTH) },
      });
    },
    [state, persist],
  );

  const resetProgress = useCallback(async () => {
    await clearGameState();
    setState(null);
    setSaveWarning(false);
    setStatus('no-profile');
  }, []);

  const startFresh = useCallback(() => {
    setState(null);
    setStatus('no-profile');
  }, []);

  const value = useMemo<GameStateContextValue>(
    () => ({
      status,
      state,
      saveWarning,
      createProfile,
      recordRound,
      updateSettings,
      renamePlayer,
      resetProgress,
      startFresh,
    }),
    [status, state, saveWarning, createProfile, recordRound, updateSettings, renamePlayer, resetProgress, startFresh],
  );

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}

export function useGameState(): GameStateContextValue {
  const ctx = useContext(GameStateContext);
  if (!ctx) throw new Error('useGameState must be used inside a GameStateProvider');
  return ctx;
}
