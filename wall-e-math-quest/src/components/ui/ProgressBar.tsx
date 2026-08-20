import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii } from '@/theme';

/** Generic fill bar — used for the "rounds until unlock" indicator. */
export function ProgressBar({
  value,
  max,
  color = colors.eveGreen,
  height = 10,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <View style={[styles.track, { height }]} accessibilityLabel={`${value} of ${max}`}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.22)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radii.pill },
});
