import { ROUND_DURATION_MS, elapsedMs, remainingMs } from '@/utils/timerMath';

/**
 * AC-2 requires the round to be exactly 60s +/- 100ms. The timer derives its
 * remaining time from wall-clock deltas, so these assertions pin the maths
 * that guarantees it rather than the interval that samples it.
 */
describe('round timer arithmetic', () => {
  const START = 1_700_000_000_000;

  it('runs for exactly the round duration', () => {
    expect(remainingMs(ROUND_DURATION_MS, 0, START, START)).toBe(60_000);
    expect(remainingMs(ROUND_DURATION_MS, 0, START, START + 59_950)).toBe(50);
    expect(remainingMs(ROUND_DURATION_MS, 0, START, START + 60_000)).toBe(0);
  });

  it('never reports a negative remainder', () => {
    expect(remainingMs(ROUND_DURATION_MS, 0, START, START + 90_000)).toBe(0);
  });

  it('stops accumulating while paused (AC-9)', () => {
    // Ran 20s, then paused.
    const accumulated = 20_000;
    // 5 minutes of being backgrounded must not consume any round time.
    expect(remainingMs(ROUND_DURATION_MS, accumulated, null, START + 300_000)).toBe(40_000);
  });

  it('resumes from where it paused', () => {
    const accumulated = 20_000;
    const resumedAt = START + 300_000;
    expect(elapsedMs(accumulated, resumedAt, resumedAt + 10_000)).toBe(30_000);
    expect(remainingMs(ROUND_DURATION_MS, accumulated, resumedAt, resumedAt + 10_000)).toBe(30_000);
  });

  it('stays inside the 100ms accuracy budget across a sampled run', () => {
    // Simulate 50ms sampling with 7ms of jitter on every tick.
    let worstError = 0;
    for (let tick = 0; tick <= 1200; tick += 1) {
      const now = START + tick * 50 + (tick % 3) * 7;
      const left = remainingMs(ROUND_DURATION_MS, 0, START, now);
      const trueLeft = Math.max(0, ROUND_DURATION_MS - (now - START));
      worstError = Math.max(worstError, Math.abs(left - trueLeft));
    }
    expect(worstError).toBeLessThanOrEqual(100);
  });
});
