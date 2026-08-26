import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { DraggableItem } from '@/types';
import { useSound } from '@/hooks/useSound';
import { MIN_TOUCH_TARGET, RESULT_ANIMATION_MS, colors, radii, spacing, typography } from '@/theme';
import type { PuzzleRendererProps } from './types';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const ITEM_SIZE = 76; // comfortably above the 44x44pt minimum

/**
 * PRD Section 5.2 Type B — drag scrambled items onto their target slots.
 *
 * Correct placement locks with a green glow and a chime; an incorrect one
 * springs back with a shake and M-O's scrubbing sound. A wrong placement
 * spends one of the puzzle's retries, and once they are gone the remaining
 * items snap to the answer before the round moves on.
 */
export function DragAndDrop({ puzzle, onAttempt, onResolved, locked = false }: PuzzleRendererProps) {
  const items = useMemo(() => puzzle.draggableItems ?? [], [puzzle.draggableItems]);
  const slotCount = items.length;
  const { play } = useSound();

  const [placed, setPlaced] = useState<Record<number, string>>({});
  const [autoSolved, setAutoSolved] = useState(false);
  const [busy, setBusy] = useState(false);

  const slotRects = useRef<Record<number, Rect>>({});
  // Slot layouts are reported relative to the slot row, so the row's own
  // offset has to be added to compare against a board-space drop point.
  const slotRowOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Shared values, not refs: the pan worklet runs on the UI thread and cannot
  // read a React ref.
  const trayOffsetX = useSharedValue(0);
  const trayOffsetY = useSharedValue(0);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPlaced({});
    setAutoSolved(false);
    setBusy(false);
    slotRects.current = {};
  }, [puzzle.id]);

  useEffect(
    () => () => {
      if (finishTimer.current) clearTimeout(finishTimer.current);
    },
    [],
  );

  const finish = useCallback(
    (correct: boolean) => {
      setBusy(true);
      finishTimer.current = setTimeout(() => onResolved(correct), RESULT_ANIMATION_MS);
    },
    [onResolved],
  );

  const handleDrop = useCallback(
    (item: DraggableItem, dropX: number, dropY: number) => {
      if (locked || busy) return false;

      const { x: rowX, y: rowY } = slotRowOffset.current;
      const slotIndex = Object.entries(slotRects.current).find(([, rect]) => {
        const left = rect.x + rowX;
        const top = rect.y + rowY;
        return (
          dropX >= left &&
          dropX <= left + rect.width &&
          dropY >= top &&
          dropY <= top + rect.height
        );
      })?.[0];

      // Dropped outside any slot: no penalty, the item just goes home
      // (PRD Section 15).
      if (slotIndex === undefined) return false;

      const index = Number(slotIndex);
      if (placed[index]) return false;

      if (index === item.correctPosition) {
        const next = { ...placed, [index]: item.id };
        setPlaced(next);
        play('drag_correct');
        if (Object.keys(next).length === slotCount) {
          onAttempt(true);
          finish(true);
        }
        return true;
      }

      play('drag_incorrect');
      play('mo_scrub');
      const result = onAttempt(false);
      if (result.resolved && result.revealed) {
        // Out of retries — show the answer, then move on.
        const solution: Record<number, string> = {};
        items.forEach((i) => {
          solution[i.correctPosition] = i.id;
        });
        setPlaced(solution);
        setAutoSolved(true);
        finish(false);
      }
      return false;
    },
    [locked, busy, placed, slotCount, items, onAttempt, play, finish],
  );

  const onSlotLayout = useCallback((index: number) => (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    slotRects.current[index] = { x, y, width, height };
  }, []);

  const onSlotRowLayout = useCallback((event: LayoutChangeEvent) => {
    const { x, y } = event.nativeEvent.layout;
    slotRowOffset.current = { x, y };
  }, []);

  const onTrayLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { x, y } = event.nativeEvent.layout;
      trayOffsetX.value = x;
      trayOffsetY.value = y;
    },
    [trayOffsetX, trayOffsetY],
  );

  const placedIds = new Set(Object.values(placed));

  return (
    <View style={styles.root}>
      <Text style={styles.prompt} accessibilityRole="header">
        {puzzle.prompt}
      </Text>

      <View style={styles.board}>
        <View style={styles.slotRow} onLayout={onSlotRowLayout}>
          {Array.from({ length: slotCount }).map((_, index) => {
            const itemId = placed[index];
            const item = items.find((i) => i.id === itemId);
            return (
              <View
                key={`slot-${index}`}
                onLayout={onSlotLayout(index)}
                style={[styles.slot, item && styles.slotFilled, autoSolved && styles.slotRevealed]}
                accessibilityLabel={`Slot ${index + 1}${item ? `, ${item.label}` : ', empty'}`}
              >
                {item ? (
                  <Text style={styles.itemLabel} numberOfLines={2} adjustsFontSizeToFit>
                    {item.label}
                  </Text>
                ) : (
                  <Text style={styles.slotIndex}>{index + 1}</Text>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.tray} onLayout={onTrayLayout}>
          {items.map((item) =>
            placedIds.has(item.id) ? (
              <View key={item.id} style={[styles.item, styles.itemSpent]} />
            ) : (
              <DraggableChip
                key={item.id}
                item={item}
                disabled={locked || busy}
                trayOffsetX={trayOffsetX}
                trayOffsetY={trayOffsetY}
                onDrop={handleDrop}
              />
            ),
          )}
        </View>
      </View>
    </View>
  );
}

function DraggableChip({
  item,
  disabled,
  trayOffsetX,
  trayOffsetY,
  onDrop,
}: {
  item: DraggableItem;
  disabled: boolean;
  trayOffsetX: SharedValue<number>;
  trayOffsetY: SharedValue<number>;
  onDrop: (item: DraggableItem, x: number, y: number) => boolean;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  // The chip's resting position inside the tray, in tray coordinates.
  const restX = useSharedValue(0);
  const restY = useSharedValue(0);

  const settle = useCallback(
    (accepted: boolean) => {
      if (accepted) {
        translateX.value = 0;
        translateY.value = 0;
      } else {
        // Gentle shake, then spring home (PRD Section 5.2 Type B).
        const current = translateX.value;
        translateX.value = withSequence(
          withTiming(current - 8, { duration: 55 }),
          withTiming(current + 8, { duration: 55 }),
          withSpring(0, { damping: 14 }),
        );
        translateY.value = withSpring(0, { damping: 14 });
      }
      scale.value = withSpring(1);
    },
    [translateX, translateY, scale],
  );

  const release = useCallback(
    (x: number, y: number) => {
      settle(onDrop(item, x, y));
    },
    [item, onDrop, settle],
  );

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onStart(() => {
      scale.value = withSpring(1.12);
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      // Board-space centre of the chip at the moment of release, so it can be
      // hit-tested against the slot rects (also measured in board space).
      const centreX = trayOffsetX.value + restX.value + event.translationX + ITEM_SIZE / 2;
      const centreY = trayOffsetY.value + restY.value + event.translationY + ITEM_SIZE / 2;
      runOnJS(release)(centreX, centreY);
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: scale.value > 1 ? 10 : 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        onLayout={(event) => {
          restX.value = event.nativeEvent.layout.x;
          restY.value = event.nativeEvent.layout.y;
        }}
        accessibilityLabel={`Draggable ${item.label}`}
        style={[styles.item, style]}
      >
        <Text style={styles.itemLabel} numberOfLines={2} adjustsFontSizeToFit>
          {item.label}
        </Text>
      </Animated.View>
    </GestureDetector>
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
  board: {
    flex: 1,
    backgroundColor: colors.eveWhite,
    borderRadius: 18,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  slotRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.sm },
  slot: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: radii.md,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.dust,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  slotFilled: {
    borderStyle: 'solid',
    borderColor: colors.correct,
    backgroundColor: colors.eveGlow,
  },
  slotRevealed: { borderColor: colors.warning, backgroundColor: '#FBEED6' },
  slotIndex: { ...typography.body, color: colors.locked },
  tray: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    minHeight: ITEM_SIZE + spacing.sm,
  },
  item: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.md,
    backgroundColor: colors.sand,
    borderWidth: 3,
    borderColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  itemSpent: { opacity: 0, borderWidth: 0 },
  itemLabel: { ...typography.subheading, color: colors.textOnLight, textAlign: 'center' },
});
