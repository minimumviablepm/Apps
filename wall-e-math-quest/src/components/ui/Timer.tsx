import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { TIMER_WARNING_MS } from '@/utils/timerMath';
import { colors, radii, spacing, typography } from '@/theme';

/**
 * The round timer bar. Depletes left-to-right over the round and turns amber
 * for the final ten seconds (PRD Section 10, Screen 3).
 */
export function Timer({ remainingMs, progress }: { remainingMs: number; progress: number }) {
  const width = useSharedValue(progress);

  useEffect(() => {
    // Match the sampling interval so the bar glides instead of stepping.
    width.value = withTiming(progress, { duration: 80, easing: Easing.linear });
  }, [progress, width]);

  const isWarning = remainingMs <= TIMER_WARNING_MS;
  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.max(0, width.value) * 100}%` }));
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <View style={styles.wrapper}>
      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, { backgroundColor: isWarning ? colors.warning : colors.eveGreen }, fillStyle]}
        />
      </View>
      <Text
        accessibilityLabel={`${seconds} seconds left`}
        style={[styles.seconds, isWarning && { color: colors.warning }]}
      >
        {seconds}s
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: {
    flex: 1,
    height: 14,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.25)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radii.pill },
  seconds: { ...typography.label, color: colors.textOnDark, width: 38, textAlign: 'right' },
});
