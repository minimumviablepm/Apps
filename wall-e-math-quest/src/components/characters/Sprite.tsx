import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { CharacterId } from '@/types';
import { getCharacter } from '@/data/characters';
import { radii, typography } from '@/theme';

export type SpriteSize = 'sm' | 'md' | 'lg';

const SIZES: Record<SpriteSize, number> = { sm: 56, md: 96, lg: 140 };

/**
 * Placeholder character sprite (PRD Section 19.8): a coloured rounded
 * rectangle carrying the character's name.
 *
 * Swapping in real art means replacing the <View> with an <Image> fed by a
 * `sprite` field on the character config — nothing else in the app reads the
 * character's appearance.
 */
export function Sprite({
  id,
  size = 'md',
  style,
}: {
  id: CharacterId;
  size?: SpriteSize;
  style?: ViewStyle;
}) {
  const character = getCharacter(id);
  const dimension = SIZES[size];

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={character.name}
      style={[
        styles.sprite,
        { width: dimension, height: dimension, backgroundColor: character.color },
        style,
      ]}
    >
      <Text
        numberOfLines={2}
        adjustsFontSizeToFit
        style={[styles.name, { color: character.textColor, fontSize: dimension * 0.16 }]}
      >
        {character.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sprite: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.18)',
    padding: 6,
  },
  name: {
    ...typography.label,
    textAlign: 'center',
  },
});
