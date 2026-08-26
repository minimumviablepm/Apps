import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

export function ScoreCounter({ score }: { score: number }) {
  return (
    <View style={styles.pill} accessibilityLabel={`Score ${score}`}>
      <Text style={styles.label}>SCORE</Text>
      <Text style={styles.value}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  label: { ...typography.label, color: colors.dust },
  value: { ...typography.subheading, color: colors.textOnDark },
});
