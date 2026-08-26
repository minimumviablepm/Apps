import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

/** The text bubble every character speaks through (PRD Section 7.1). */
export function SpeechBubble({ text, tone = 'neutral' }: { text: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const background =
    tone === 'good' ? colors.eveGlow : tone === 'bad' ? '#F6DACD' : colors.eveWhite;

  return (
    <View style={[styles.bubble, { backgroundColor: background }]}>
      <Text style={styles.text}>{text}</Text>
      <View style={[styles.tail, { borderTopColor: background }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    maxWidth: 260,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  text: {
    ...typography.body,
    color: colors.textOnLight,
    textAlign: 'center',
  },
  tail: {
    position: 'absolute',
    bottom: -10,
    left: 24,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
