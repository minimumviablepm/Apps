import { useCallback, useEffect, useRef, useState } from 'react';

import { ROUND_DURATION_MS, TIMER_WARNING_MS, elapsedMs, remainingMs } from '@/utils/timerMath';

export { ROUND_DURATION_MS, TIMER_WARNING_MS, elapsedMs, remainingMs };

const TICK_MS = 50;

export interface UseTimerOptions {
  durationMs?: number;
  /** Fired once, when the countdown reaches zero. */
  onExpire?: () => void;
  /** Fired once, when the remaining time first drops below the warning mark. */
  onWarning?: () => void;
}

export interface TimerController {
  remainingMs: number;
  elapsedMs: number;
  isRunning: boolean;
  hasExpired: boolean;
  /** Fraction still to run, 1 -> 0. Drives the timer bar. */
  progress: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

/**
 * A pausable countdown driven by wall-clock deltas rather than tick counting,
 * so a dropped frame or a throttled interval cannot make the round short or
 * long. Backgrounding is handled by the caller calling pause()/resume().
 */
export function useTimer({
  durationMs = ROUND_DURATION_MS,
  onExpire,
  onWarning,
}: UseTimerOptions = {}): TimerController {
  const accumulated = useRef(0);
  const runningSince = useRef<number | null>(null);
  const expired = useRef(false);
  const warned = useRef(false);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  const [remaining, setRemaining] = useState(durationMs);
  const [isRunning, setIsRunning] = useState(false);

  const onExpireRef = useRef(onExpire);
  const onWarningRef = useRef(onWarning);
  onExpireRef.current = onExpire;
  onWarningRef.current = onWarning;

  const clear = useCallback(() => {
    if (interval.current !== null) {
      clearInterval(interval.current);
      interval.current = null;
    }
  }, []);

  const sample = useCallback(() => {
    const left = remainingMs(durationMs, accumulated.current, runningSince.current, Date.now());
    setRemaining(left);

    if (!warned.current && left <= TIMER_WARNING_MS && left > 0) {
      warned.current = true;
      onWarningRef.current?.();
    }

    if (left <= 0 && !expired.current) {
      expired.current = true;
      accumulated.current = durationMs;
      runningSince.current = null;
      clear();
      setIsRunning(false);
      onExpireRef.current?.();
    }
  }, [durationMs, clear]);

  const tickFrom = useCallback(() => {
    clear();
    interval.current = setInterval(sample, TICK_MS);
  }, [clear, sample]);

  const start = useCallback(() => {
    accumulated.current = 0;
    expired.current = false;
    warned.current = false;
    runningSince.current = Date.now();
    setRemaining(durationMs);
    setIsRunning(true);
    tickFrom();
  }, [durationMs, tickFrom]);

  const pause = useCallback(() => {
    if (runningSince.current === null || expired.current) return;
    accumulated.current += Date.now() - runningSince.current;
    runningSince.current = null;
    clear();
    setIsRunning(false);
    setRemaining(Math.max(0, durationMs - accumulated.current));
  }, [clear, durationMs]);

  const resume = useCallback(() => {
    if (runningSince.current !== null || expired.current) return;
    runningSince.current = Date.now();
    setIsRunning(true);
    tickFrom();
  }, [tickFrom]);

  const reset = useCallback(() => {
    clear();
    accumulated.current = 0;
    runningSince.current = null;
    expired.current = false;
    warned.current = false;
    setRemaining(durationMs);
    setIsRunning(false);
  }, [clear, durationMs]);

  useEffect(() => clear, [clear]);

  const elapsed = durationMs - remaining;
  return {
    remainingMs: remaining,
    elapsedMs: elapsed,
    isRunning,
    hasExpired: remaining <= 0,
    progress: durationMs === 0 ? 0 : remaining / durationMs,
    start,
    pause,
    resume,
    reset,
  };
}
