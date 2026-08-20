import { Audio } from 'expo-av';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import { useGameState } from './useGameState';

/**
 * PRD Section 19.5 — every sound is preloaded on launch and held in a ref.
 * Nothing is loaded on demand during gameplay.
 */
export const SOUND_FILES = {
  round_start: require('../../assets/sounds/round_start.wav'),
  correct: require('../../assets/sounds/correct.wav'),
  wrong: require('../../assets/sounds/wrong.wav'),
  timer_warning: require('../../assets/sounds/timer_warning.wav'),
  round_end_low: require('../../assets/sounds/round_end_low.wav'),
  round_end_mid: require('../../assets/sounds/round_end_mid.wav'),
  round_end_high: require('../../assets/sounds/round_end_high.wav'),
  tier_unlock: require('../../assets/sounds/tier_unlock.wav'),
  drag_correct: require('../../assets/sounds/drag_correct.wav'),
  drag_incorrect: require('../../assets/sounds/drag_incorrect.wav'),
  walle_beep: require('../../assets/sounds/walle_beep.wav'),
  mo_scrub: require('../../assets/sounds/mo_scrub.wav'),
  auto_buzz: require('../../assets/sounds/auto_buzz.wav'),
  bot_clunk: require('../../assets/sounds/bot_clunk.wav'),
  bot_spring: require('../../assets/sounds/bot_spring.wav'),
  bot_umbrella: require('../../assets/sounds/bot_umbrella.wav'),
} as const;

export const MUSIC_FILES = {
  door_selection: require('../../assets/sounds/music_door.wav'),
  drag_and_drop: require('../../assets/sounds/music_drag.wav'),
  pattern_completion: require('../../assets/sounds/music_pattern.wav'),
} as const;

export type SoundKey = keyof typeof SOUND_FILES;
export type MusicKey = keyof typeof MUSIC_FILES;

/** PRD Section 10, Screen 4 — the round-end fanfare scales with the score. */
export function roundEndSoundFor(percentage: number): SoundKey {
  if (percentage >= 80) return 'round_end_high';
  if (percentage >= 60) return 'round_end_mid';
  return 'round_end_low';
}

interface SoundContextValue {
  play: (key: SoundKey) => void;
  startLoop: (key: SoundKey) => void;
  stopLoop: (key: SoundKey) => void;
  playMusic: (key: MusicKey) => void;
  stopMusic: () => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

const MUSIC_VOLUME = 0.35;

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const { state } = useGameState();
  const soundEnabled = state?.settings.soundEnabled ?? true;
  const musicEnabled = state?.settings.musicEnabled ?? true;

  const effects = useRef<Partial<Record<SoundKey, Audio.Sound>>>({});
  const music = useRef<Partial<Record<MusicKey, Audio.Sound>>>({});
  const currentMusic = useRef<MusicKey | null>(null);
  const loops = useRef(new Set<SoundKey>());
  const enabledRef = useRef({ sound: soundEnabled, music: musicEnabled });
  enabledRef.current = { sound: soundEnabled, music: musicEnabled };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      } catch {
        // Audio session config is best-effort; playback still works without it.
      }

      await Promise.all(
        Object.entries(SOUND_FILES).map(async ([key, asset]) => {
          try {
            const { sound } = await Audio.Sound.createAsync(asset);
            if (cancelled) {
              await sound.unloadAsync();
              return;
            }
            effects.current[key as SoundKey] = sound;
          } catch {
            // A single failed asset must not take the whole game down.
          }
        }),
      );

      await Promise.all(
        Object.entries(MUSIC_FILES).map(async ([key, asset]) => {
          try {
            const { sound } = await Audio.Sound.createAsync(asset, {
              isLooping: true,
              volume: MUSIC_VOLUME,
            });
            if (cancelled) {
              await sound.unloadAsync();
              return;
            }
            music.current[key as MusicKey] = sound;
          } catch {
            /* see above */
          }
        }),
      );
    })();

    return () => {
      cancelled = true;
      Object.values(effects.current).forEach((s) => void s?.unloadAsync());
      Object.values(music.current).forEach((s) => void s?.unloadAsync());
      effects.current = {};
      music.current = {};
    };
  }, []);

  const play = useCallback((key: SoundKey) => {
    if (!enabledRef.current.sound) return;
    const sound = effects.current[key];
    if (!sound) return;
    // Rewind first: replaying a still-playing effect is common during fast
    // rounds and playAsync alone would be a no-op.
    void sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => {});
  }, []);

  const startLoop = useCallback((key: SoundKey) => {
    if (!enabledRef.current.sound) return;
    const sound = effects.current[key];
    if (!sound || loops.current.has(key)) return;
    loops.current.add(key);
    void sound
      .setIsLoopingAsync(true)
      .then(() => sound.setPositionAsync(0))
      .then(() => sound.playAsync())
      .catch(() => {});
  }, []);

  const stopLoop = useCallback((key: SoundKey) => {
    const sound = effects.current[key];
    loops.current.delete(key);
    if (!sound) return;
    void sound.stopAsync().then(() => sound.setIsLoopingAsync(false)).catch(() => {});
  }, []);

  const stopMusic = useCallback(() => {
    const key = currentMusic.current;
    currentMusic.current = null;
    if (!key) return;
    void music.current[key]?.stopAsync().catch(() => {});
  }, []);

  const playMusic = useCallback(
    (key: MusicKey) => {
      if (!enabledRef.current.music) {
        stopMusic();
        return;
      }
      if (currentMusic.current === key) return;
      stopMusic();
      currentMusic.current = key;
      void music.current[key]?.playAsync().catch(() => {});
    },
    [stopMusic],
  );

  // Flipping the toggles off in Settings must silence what is already running.
  useEffect(() => {
    if (!soundEnabled) loops.current.forEach((key) => stopLoop(key));
  }, [soundEnabled, stopLoop]);

  useEffect(() => {
    if (!musicEnabled) stopMusic();
  }, [musicEnabled, stopMusic]);

  const value = useMemo(
    () => ({ play, startLoop, stopLoop, playMusic, stopMusic }),
    [play, startLoop, stopLoop, playMusic, stopMusic],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useSound must be used inside a SoundProvider');
  return ctx;
}
