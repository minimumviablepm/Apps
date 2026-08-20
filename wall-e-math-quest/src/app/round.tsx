import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Sprite } from '@/components/characters/Sprite';
import { DoorSelection } from '@/components/puzzles/DoorSelection';
import { DragAndDrop } from '@/components/puzzles/DragAndDrop';
import { PatternCompletion } from '@/components/puzzles/PatternCompletion';
import { ScoreCounter } from '@/components/ui/ScoreCounter';
import { Timer } from '@/components/ui/Timer';
import { TIERS } from '@/data/tiers';
import { useGameState } from '@/hooks/useGameState';
import { usePuzzleEngine } from '@/hooks/usePuzzleEngine';
import { ROUND_DURATION_MS, useTimer } from '@/hooks/useTimer';
import { useSound, roundEndSoundFor } from '@/hooks/useSound';
import { COUNTDOWN_SECONDS, colors, radii, spacing, typography } from '@/theme';

type Phase = 'countdown' | 'playing' | 'paused' | 'finished';

/** Screen 3 — Round gameplay (PRD Section 10). */
export default function RoundScreen() {
  const params = useLocalSearchParams<{ tierId?: string }>();
  const tierId = Number(params.tierId ?? 1);
  const router = useRouter();
  const { status, recordRound } = useGameState();
  const { play, startLoop, stopLoop, playMusic, stopMusic } = useSound();

  const engine = usePuzzleEngine(tierId);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [walleMood, setWalleMood] = useState<'idle' | 'happy' | 'sad'>('idle');
  const finishing = useRef(false);
  // Mirrors `phase` for the AppState listener, which must not re-subscribe on
  // every render just to read it.
  const phaseRef = useRef<Phase>('countdown');
  phaseRef.current = phase;
  // True between "the answer resolved" and "its reveal animation finished".
  const revealing = useRef(false);
  // Set when the clock runs out mid-reveal (PRD Section 15).
  const endAfterReveal = useRef(false);

  const endRound = useCallback(
    async (durationMs: number) => {
      if (finishing.current) return;
      finishing.current = true;
      setPhase('finished');
      stopLoop('timer_warning');
      stopMusic();

      const result = engine.buildResult(durationMs);
      play(roundEndSoundFor(result.percentage));
      const outcome = await recordRound(result);

      router.replace({
        pathname: '/score',
        params: {
          tierId: String(result.tierId),
          score: String(result.score),
          total: String(result.totalPuzzles),
          percentage: String(result.percentage),
          stars: String(outcome.roundStars),
          unlocked: outcome.unlockedTierId ? String(outcome.unlockedTierId) : '',
        },
      });
    },
    [engine, recordRound, router, play, stopLoop, stopMusic],
  );

  const timer = useTimer({
    durationMs: ROUND_DURATION_MS,
    onExpire: () => {
      // "Timer hits 0 mid-door-animation: animation completes, then round
      // ends. That puzzle counts toward score." (PRD Section 15)
      if (revealing.current) {
        endAfterReveal.current = true;
        return;
      }
      void endRound(ROUND_DURATION_MS);
    },
    onWarning: () => startLoop('timer_warning'),
  });

  // "3-2-1" pre-round countdown. Deliberately not skippable (PRD Open Q #5).
  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    if (countdown === COUNTDOWN_SECONDS) play('round_start');
    if (countdown <= 0) {
      engine.begin();
      timer.start();
      setPhase('playing');
      return undefined;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(id);
    // engine/timer identities are stable for the life of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown]);

  // PRD Section 13 / AC-9 — backgrounding pauses the timer; resuming shows a
  // "Ready?" overlay that the player must tap.
  const pauseTimer = timer.pause;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' || phaseRef.current !== 'playing') return;
      pauseTimer();
      stopLoop('timer_warning');
      stopMusic();
      setPhase('paused');
    });
    return () => subscription.remove();
  }, [pauseTimer, stopLoop, stopMusic]);

  // Background music follows the puzzle type on screen (PRD Section 9).
  const currentType = engine.currentPuzzle?.type;
  useEffect(() => {
    if (phase === 'playing' && currentType) playMusic(currentType);
  }, [phase, currentType, playMusic]);

  useEffect(() => () => stopMusic(), [stopMusic]);

  const handleAttempt = useCallback(
    (correct: boolean) => {
      const result = engine.submitAttempt(correct);
      // Only a resolving attempt owes the round a score, so only that one is
      // worth holding the clock open for; a retry reveal can be cut short.
      if (result.resolved) revealing.current = true;
      return result;
    },
    [engine],
  );

  const handleResolved = useCallback(
    (correct: boolean) => {
      revealing.current = false;
      setWalleMood(correct ? 'happy' : 'sad');

      if (endAfterReveal.current || timer.hasExpired) {
        void endRound(ROUND_DURATION_MS);
        return;
      }
      const next = engine.advance();
      // The pool ran dry before the clock did — end on real elapsed time.
      if (!next) void endRound(ROUND_DURATION_MS - timer.remainingMs);
    },
    [engine, timer.hasExpired, timer.remainingMs, endRound],
  );

  if (status === 'no-profile' || status === 'load-error') return <Redirect href="/" />;

  const puzzle = engine.currentPuzzle;
  const tierLabel = TIERS.find((t) => t.tierId === tierId)?.label ?? 'Quest';
  const rendererProps = {
    onAttempt: handleAttempt,
    onResolved: handleResolved,
    locked: phase !== 'playing',
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.hud}>
        <View style={styles.hudRow}>
          <Text style={styles.tierLabel} numberOfLines={1}>
            {tierLabel}
          </Text>
          <ScoreCounter score={engine.score} />
        </View>
        <Timer remainingMs={timer.remainingMs} progress={timer.progress} />
      </View>

      <View style={styles.puzzleArea}>
        {puzzle && phase !== 'countdown' ? (
          puzzle.type === 'door_selection' ? (
            <DoorSelection key={puzzle.id} puzzle={puzzle} {...rendererProps} />
          ) : puzzle.type === 'drag_and_drop' ? (
            <DragAndDrop key={puzzle.id} puzzle={puzzle} {...rendererProps} />
          ) : (
            <PatternCompletion key={puzzle.id} puzzle={puzzle} {...rendererProps} />
          )
        ) : null}
      </View>

      <View style={styles.footer}>
        <Sprite id="walle" size="sm" />
        <Text style={styles.mood}>
          {walleMood === 'happy' ? 'Wall-E is thrilled!' : walleMood === 'sad' ? 'Keep going!' : "Let's find Eve!"}
        </Text>
      </View>

      {phase === 'countdown' ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.overlay}>
          <Animated.Text key={countdown} entering={ZoomIn} style={styles.countdown}>
            {countdown > 0 ? countdown : 'GO!'}
          </Animated.Text>
        </Animated.View>
      ) : null}

      {phase === 'paused' ? (
        <Animated.View entering={FadeIn} style={styles.overlay}>
          <Text style={styles.readyTitle}>Ready?</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Resume round"
            onPress={() => {
              setPhase('playing');
              timer.resume();
            }}
            style={styles.readyButton}
          >
            <Text style={styles.readyButtonText}>Tap to keep playing</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.charcoal },
  hud: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  hudRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tierLabel: { ...typography.subheading, color: colors.dust, flex: 1 },
  // PRD Screen 3 — the puzzle owns roughly 70% of the screen.
  puzzleArea: { flex: 7, padding: spacing.md },
  footer: {
    flex: 1,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  mood: { ...typography.body, color: colors.dust, flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  countdown: { fontSize: 96, fontWeight: '900', color: colors.eveGlow },
  readyTitle: { ...typography.title, color: colors.textOnDark },
  readyButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.eveGreen,
    borderRadius: radii.pill,
  },
  readyButtonText: { ...typography.subheading, color: '#FFFFFF' },
});
