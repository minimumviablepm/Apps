import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme';

/**
 * Parallax corridor backdrop for the door puzzles (PRD Section 8.1).
 *
 * Two slow-drifting stripe layers at different speeds — cheap enough to keep
 * 60fps on an iPhone SE alongside the door animation.
 */
export function Corridor({ children }: { children: React.ReactNode }) {
  const far = useSharedValue(0);
  const near = useSharedValue(0);

  useEffect(() => {
    far.value = withRepeat(withTiming(-120, { duration: 18000, easing: Easing.linear }), -1, false);
    near.value = withRepeat(withTiming(-120, { duration: 9000, easing: Easing.linear }), -1, false);
  }, [far, near]);

  const farStyle = useAnimatedStyle(() => ({ transform: [{ translateX: far.value }] }));
  const nearStyle = useAnimatedStyle(() => ({ transform: [{ translateX: near.value }] }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.layer, farStyle]}>
        {Array.from({ length: 14 }).map((_, i) => (
          <View key={i} style={[styles.farStripe, { left: i * 120 }]} />
        ))}
      </Animated.View>
      <Animated.View style={[styles.layer, nearStyle]}>
        {Array.from({ length: 14 }).map((_, i) => (
          <View key={i} style={[styles.nearStripe, { left: i * 120 }]} />
        ))}
      </Animated.View>
      <View style={styles.floor} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.soil, overflow: 'hidden', borderRadius: 18 },
  layer: { ...StyleSheet.absoluteFillObject },
  farStripe: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 58,
    backgroundColor: 'rgba(232, 213, 176, 0.07)',
  },
  nearStripe: {
    position: 'absolute',
    top: '18%',
    bottom: '22%',
    width: 26,
    backgroundColor: 'rgba(232, 213, 176, 0.10)',
  },
  floor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '18%',
    backgroundColor: 'rgba(36, 28, 20, 0.45)',
  },
  content: { flex: 1 },
});
