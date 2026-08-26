/**
 * Pure countdown maths, kept out of the hook so the 60s +/- 100ms accuracy
 * requirement (AC-2) can be asserted without a React renderer or a real clock.
 */

/** PRD Section 5.1 — every round is exactly 60 seconds. */
export const ROUND_DURATION_MS = 60_000;
/** PRD Section 9 — the ticking speedup starts with 10s left. */
export const TIMER_WARNING_MS = 10_000;

/** Wall-clock elapsed time for a timer that may have been paused. */
export function elapsedMs(
  accumulatedMs: number,
  runningSince: number | null,
  now: number,
): number {
  return runningSince === null ? accumulatedMs : accumulatedMs + (now - runningSince);
}

export function remainingMs(
  durationMs: number,
  accumulatedMs: number,
  runningSince: number | null,
  now: number,
): number {
  return Math.max(0, durationMs - elapsedMs(accumulatedMs, runningSince, now));
}
