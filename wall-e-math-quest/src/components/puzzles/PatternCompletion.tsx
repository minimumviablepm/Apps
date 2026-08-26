import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useSound } from '@/hooks/useSound';
import { MIN_TOUCH_TARGET, RESULT_ANIMATION_MS, colors, radii, spacing, typography } from '@/theme';
import type { PuzzleRendererProps } from './types';

/** A tray option is identified by index, since the same label can repeat. */
interface Selection {
  blankIndex: number;
  optionIndex: number;
}

/**
 * PRD Section 5.2 Type C — a sequence with 1-2 blanks and a tray of options.
 *
 * Tapping a tray option drops it into the next empty blank; tapping it again
 * (or tapping the filled blank) puts it back (PRD Section 15). Once every
 * blank is filled the answer is checked: correct fills sparkle and lock,
 * wrong ones flash and fade back to the tray with a buzz.
 */
export function PatternCompletion({
  puzzle,
  onAttempt,
  onResolved,
  locked = false,
}: PuzzleRendererProps) {
  const sequence = useMemo(() => puzzle.sequence ?? [], [puzzle.sequence]);
  const fillOptions = useMemo(() => puzzle.fillOptions ?? [], [puzzle.fillOptions]);
  const correctFills = useMemo(() => puzzle.correctFills ?? [], [puzzle.correctFills]);
  const { play } = useSound();

  const blankIndexes = useMemo(
    () => sequence.map((cell, i) => (cell.isBlank ? i : -1)).filter((i) => i >= 0),
    [sequence],
  );

  const [selections, setSelections] = useState<Selection[]>([]);
  const [locked_, setLockedFills] = useState<Record<number, boolean>>({});
  const [rejected, setRejected] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSelections([]);
    setLockedFills({});
    setRejected([]);
    setRevealed(false);
    setBusy(false);
  }, [puzzle.id]);

  useEffect(
    () => () => {
      if (finishTimer.current) clearTimeout(finishTimer.current);
    },
    [],
  );

  const answerFor = useCallback(
    (blankIndex: number) => correctFills[blankIndexes.indexOf(blankIndex)] ?? '',
    [correctFills, blankIndexes],
  );

  const evaluate = useCallback(
    (current: Selection[]) => {
      const wrong = current.filter(
        (s) => fillOptions[s.optionIndex] !== answerFor(s.blankIndex),
      );

      if (wrong.length === 0) {
        setLockedFills(Object.fromEntries(current.map((s) => [s.blankIndex, true])));
        play('drag_correct');
        onAttempt(true);
        setBusy(true);
        finishTimer.current = setTimeout(() => onResolved(true), RESULT_ANIMATION_MS);
        return;
      }

      play('wrong');
      const result = onAttempt(false);
      setRejected(wrong.map((s) => s.blankIndex));

      if (result.resolved && result.revealed) {
        setRevealed(true);
        setBusy(true);
        finishTimer.current = setTimeout(() => onResolved(false), RESULT_ANIMATION_MS + 500);
        return;
      }

      // Keep whatever happened to be right; send the wrong ones back.
      setBusy(true);
      finishTimer.current = setTimeout(() => {
        setSelections((prev) => prev.filter((s) => !wrong.some((w) => w.blankIndex === s.blankIndex)));
        setRejected([]);
        setBusy(false);
      }, 600);
    },
    [fillOptions, answerFor, onAttempt, onResolved, play],
  );

  const handleOptionPress = useCallback(
    (optionIndex: number) => {
      if (locked || busy) return;

      const existing = selections.find((s) => s.optionIndex === optionIndex);
      if (existing) {
        // Second tap on the same option takes it back out of the slot.
        setSelections((prev) => prev.filter((s) => s.optionIndex !== optionIndex));
        return;
      }

      const nextBlank = blankIndexes.find((i) => !selections.some((s) => s.blankIndex === i));
      if (nextBlank === undefined) return;

      const next = [...selections, { blankIndex: nextBlank, optionIndex }];
      setSelections(next);
      if (next.length === blankIndexes.length) evaluate(next);
    },
    [locked, busy, selections, blankIndexes, evaluate],
  );

  const handleBlankPress = useCallback(
    (blankIndex: number) => {
      if (locked || busy || locked_[blankIndex]) return;
      setSelections((prev) => prev.filter((s) => s.blankIndex !== blankIndex));
    },
    [locked, busy, locked_],
  );

  const valueFor = (index: number): string | null => {
    if (revealed) return answerFor(index);
    const selection = selections.find((s) => s.blankIndex === index);
    return selection ? (fillOptions[selection.optionIndex] ?? null) : null;
  };

  const usedOptionIndexes = new Set(selections.map((s) => s.optionIndex));

  return (
    <View style={styles.root}>
      <Text style={styles.prompt} accessibilityRole="header">
        {puzzle.prompt}
      </Text>

      <View style={styles.board}>
        <View style={styles.sequenceRow}>
          {sequence.map((cell, index) =>
            cell.isBlank ? (
              <BlankCell
                key={`blank-${index}`}
                value={valueFor(index)}
                isLocked={Boolean(locked_[index])}
                isRejected={rejected.includes(index)}
                isRevealed={revealed}
                onPress={() => handleBlankPress(index)}
              />
            ) : (
              <View key={`cell-${index}`} style={styles.cell}>
                <Text style={styles.cellText} numberOfLines={1} adjustsFontSizeToFit>
                  {cell.value}
                </Text>
              </View>
            ),
          )}
        </View>

        <View style={styles.tray}>
          {fillOptions.map((option, index) => (
            <Pressable
              key={`option-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Option ${option}`}
              accessibilityState={{ selected: usedOptionIndexes.has(index) }}
              disabled={locked || busy}
              onPress={() => handleOptionPress(index)}
              style={({ pressed }) => [
                styles.option,
                usedOptionIndexes.has(index) && styles.optionUsed,
                pressed && styles.optionPressed,
              ]}
            >
              <Text style={styles.optionText} numberOfLines={1} adjustsFontSizeToFit>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function BlankCell({
  value,
  isLocked,
  isRejected,
  isRevealed,
  onPress,
}: {
  value: string | null;
  isLocked: boolean;
  isRejected: boolean;
  isRevealed: boolean;
  onPress: () => void;
}) {
  const sparkle = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (isLocked) {
      sparkle.value = withSequence(withSpring(1.25), withSpring(1));
    }
  }, [isLocked, sparkle]);

  useEffect(() => {
    if (isRejected) {
      // Briefly appears, then fades — PRD Section 5.2 Type C.
      fade.value = withSequence(withTiming(1, { duration: 150 }), withTiming(0.15, { duration: 400 }));
    } else {
      fade.value = withTiming(1, { duration: 150 });
    }
  }, [isRejected, fade]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: sparkle.value === 0 ? 1 : sparkle.value }],
    opacity: fade.value,
  }));

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Blank">
      <Animated.View
        style={[
          styles.cell,
          styles.blank,
          isLocked && styles.blankLocked,
          isRejected && styles.blankRejected,
          isRevealed && styles.blankRevealed,
          style,
        ]}
      >
        <Text style={styles.cellText} numberOfLines={1} adjustsFontSizeToFit>
          {value ?? '?'}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const CELL = 62;

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.md },
  prompt: {
    ...typography.prompt,
    color: colors.textOnDark,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  board: {
    flex: 1,
    backgroundColor: colors.eveWhite,
    borderRadius: 18,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  sequenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cell: {
    minWidth: CELL,
    height: CELL,
    paddingHorizontal: 6,
    borderRadius: radii.md,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { ...typography.subheading, color: colors.textOnLight },
  blank: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.dust,
  },
  blankLocked: {
    borderStyle: 'solid',
    borderColor: colors.correct,
    backgroundColor: colors.eveGlow,
  },
  blankRejected: { borderColor: colors.wrong, backgroundColor: '#F8DCD1' },
  blankRevealed: { borderStyle: 'solid', borderColor: colors.warning, backgroundColor: '#FBEED6' },
  tray: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  option: {
    minWidth: MIN_TOUCH_TARGET + 20,
    minHeight: MIN_TOUCH_TARGET + 8,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.dust,
    borderWidth: 3,
    borderColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionUsed: { opacity: 0.35 },
  optionPressed: { transform: [{ scale: 0.96 }] },
  optionText: { ...typography.subheading, color: colors.textOnLight },
});
