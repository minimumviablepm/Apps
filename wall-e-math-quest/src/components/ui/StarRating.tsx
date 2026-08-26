import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

/** 0-3 stars (PRD Section 10, Screens 2 and 4). */
export function StarRating({ rating, size = 24 }: { rating: number; size?: number }) {
  const stars = [1, 2, 3];
  return (
    <View style={styles.row} accessibilityLabel={`${rating} out of 3 stars`}>
      {stars.map((n) => (
        <Text
          key={n}
          style={[styles.star, { fontSize: size, color: n <= rating ? colors.star : colors.locked }]}
        >
          {n <= rating ? '★' : '☆'}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
  star: { lineHeight: undefined },
});
