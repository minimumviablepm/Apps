/**
 * PRD Section 8.1 — warm dusty earth tones (Wall-E's world) against clean
 * whites and greens (Eve's world / correct answers), chunky type, rounded
 * corners, and touch targets no smaller than 44x44pt per Apple's HIG.
 */
export const colors = {
  // Wall-E's world
  sand: '#E8D5B0',
  dust: '#C9A87C',
  rust: '#B4652A',
  soil: '#6B4A2E',
  charcoal: '#33291F',
  night: '#241C14',

  // Eve's world
  eveWhite: '#F6FBFA',
  eveGlow: '#BFF0E4',
  eveGreen: '#2FBF8F',
  eveDeep: '#12433C',

  // Feedback
  correct: '#2FBF8F',
  wrong: '#D9663D',
  warning: '#E8A33D',
  star: '#FFC94A',
  locked: '#8A8177',

  textOnDark: '#F7EFE1',
  textOnLight: '#33291F',
  overlay: 'rgba(36, 28, 20, 0.82)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

/** Apple HIG minimum. Every tappable element must clear this. */
export const MIN_TOUCH_TARGET = 44;

export const typography = {
  title: { fontSize: 34, fontWeight: '800' as const, letterSpacing: 0.5 },
  heading: { fontSize: 26, fontWeight: '800' as const },
  subheading: { fontSize: 20, fontWeight: '700' as const },
  body: { fontSize: 17, fontWeight: '600' as const },
  label: { fontSize: 14, fontWeight: '700' as const, letterSpacing: 0.8 },
  prompt: { fontSize: 24, fontWeight: '800' as const },
  door: { fontSize: 28, fontWeight: '800' as const },
} as const;

/** PRD Section 14.3 — door animation is a fixed, non-skippable 1.5s. */
export const DOOR_ANIMATION_MS = 1500;
/** Drag / pattern result animations resolve in 1s. */
export const RESULT_ANIMATION_MS = 1000;
/** PRD Section 13 — the "3-2-1" pre-round countdown (not skippable). */
export const COUNTDOWN_SECONDS = 3;
