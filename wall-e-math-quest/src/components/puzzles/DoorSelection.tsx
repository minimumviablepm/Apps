import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { CharacterId, WrongAnswerCharacterId } from '@/types';
import { CHARACTERS, pickReaction, pickWrongAnswerCharacter } from '@/data/characters';
import { useSound } from '@/hooks/useSound';
import { DOOR_ANIMATION_MS, MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';
import { SpeechBubble } from '../characters/SpeechBubble';
import { Sprite } from '../characters/Sprite';
import { Corridor } from './Corridor';
import type { PuzzleRendererProps } from './types';

/**
 * PRD Section 5.2 Type A — Wall-E in a corridor with 3-4 labelled doors.
 *
 * Tapping a door opens it over 1.5s (not skippable, PRD Section 14.3) to
 * reveal Eve for a correct answer or a weighted-random wrong-answer character
 * otherwise. The parent owns scoring; this component owns the animation and
 * tells the parent when it is done.
 */
export function DoorSelection({ puzzle, onAttempt, onResolved, locked = false }: PuzzleRendererProps) {
  const options = puzzle.options ?? [];
  const { play } = useSound();

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [revealCorrectIndex, setRevealCorrectIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // "No character repeats on consecutive wrong answers within the same round."
  const lastWrongCharacter = useRef<WrongAnswerCharacterId | null>(null);
  const lastLine = useRef<string | null>(null);
  const [reveal, setReveal] = useState<{ characterId: 'eve' | WrongAnswerCharacterId; line: string } | null>(
    null,
  );
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // A new puzzle resets every bit of door state.
    setOpenIndex(null);
    setRevealCorrectIndex(null);
    setReveal(null);
    setBusy(false);
  }, [puzzle.id]);

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );

  const handlePress = useCallback(
    (index: number) => {
      if (locked || busy) return;
      const option = options[index];
      if (!option) return;

      setBusy(true);
      setOpenIndex(index);

      const result = onAttempt(option.isCorrect);

      if (option.isCorrect) {
        const line = pickReaction('eve', lastLine.current);
        lastLine.current = line;
        setReveal({ characterId: 'eve', line });
        play('correct');
      } else {
        const characterId = pickWrongAnswerCharacter(lastWrongCharacter.current);
        lastWrongCharacter.current = characterId;
        const line = pickReaction(characterId, null);
        setReveal({ characterId, line });
        play('wrong');
        play(CHARACTERS[characterId].soundKey);
        if (result.revealed) {
          setRevealCorrectIndex(options.findIndex((o) => o.isCorrect));
        }
      }

      timeout.current = setTimeout(() => {
        if (result.resolved) {
          onResolved(option.isCorrect);
        } else {
          // Same puzzle, another go.
          setOpenIndex(null);
          setReveal(null);
          setBusy(false);
        }
      }, DOOR_ANIMATION_MS);
    },
    [locked, busy, options, onAttempt, onResolved, play],
  );

  return (
    <View style={styles.root}>
      <Text style={styles.prompt} accessibilityRole="header">
        {puzzle.prompt}
      </Text>

      <Corridor>
        <View style={styles.doorRow}>
          {options.map((option, index) => (
            <Door
              key={`${puzzle.id}-${option.label}`}
              label={option.label}
              isOpen={openIndex === index}
              isHighlighted={revealCorrectIndex === index}
              disabled={locked || busy}
              onPress={() => handlePress(index)}
              reveal={openIndex === index ? reveal : null}
            />
          ))}
        </View>

        <View style={styles.walleRow}>
          <Sprite id="walle" size="sm" />
        </View>
      </Corridor>
    </View>
  );
}

function Door({
  label,
  isOpen,
  isHighlighted,
  disabled,
  onPress,
  reveal,
}: {
  label: string;
  isOpen: boolean;
  isHighlighted: boolean;
  disabled: boolean;
  onPress: () => void;
  reveal: { characterId: CharacterId; line: string } | null;
}) {
  // The panel slides away to "open" the door; 8 frames' worth of motion in a
  // single timing curve (PRD Section 8.2).
  const openness = useSharedValue(0);
  const nudge = useSharedValue(0);

  useEffect(() => {
    openness.value = withTiming(isOpen ? 1 : 0, {
      duration: isOpen ? DOOR_ANIMATION_MS * 0.45 : 180,
      easing: Easing.out(Easing.cubic),
    });
    if (isOpen) {
      nudge.value = withSequence(
        withTiming(-4, { duration: 90 }),
        withTiming(0, { duration: 120 }),
      );
    }
  }, [isOpen, openness, nudge]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -openness.value * 92 }, { translateY: nudge.value }],
    opacity: 1 - openness.value * 0.15,
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Door ${label}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.doorFrame,
        isHighlighted && styles.doorCorrect,
        pressed && !disabled && styles.doorPressed,
      ]}
    >
      <View style={styles.doorInterior}>
        {reveal ? (
          <View style={styles.revealStack}>
            <Sprite id={reveal.characterId} size="sm" />
          </View>
        ) : null}
      </View>

      <Animated.View style={[styles.doorPanel, panelStyle]}>
        <Text style={styles.doorLabel} numberOfLines={2} adjustsFontSizeToFit>
          {label}
        </Text>
      </Animated.View>

      {reveal ? (
        <View style={styles.bubbleAnchor} pointerEvents="none">
          <SpeechBubble
            text={reveal.line}
            tone={reveal.characterId === 'eve' ? 'good' : 'bad'}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.md },
  prompt: {
    ...typography.prompt,
    color: colors.textOnDark,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  doorRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  doorFrame: {
    flex: 1,
    maxWidth: 110,
    minWidth: MIN_TOUCH_TARGET + 24,
    aspectRatio: 0.62,
    borderRadius: radii.md,
    backgroundColor: colors.night,
    borderWidth: 3,
    borderColor: colors.dust,
    overflow: 'visible',
  },
  doorCorrect: { borderColor: colors.correct, borderWidth: 4 },
  doorPressed: { transform: [{ scale: 0.97 }] },
  doorInterior: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.charcoal,
    borderRadius: radii.md - 3,
  },
  revealStack: { alignItems: 'center' },
  doorPanel: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.rust,
    borderRadius: radii.md - 3,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  doorLabel: { ...typography.door, color: colors.textOnDark, textAlign: 'center' },
  bubbleAnchor: { position: 'absolute', top: -54, left: -18, right: -18, alignItems: 'center' },
  walleRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
});
