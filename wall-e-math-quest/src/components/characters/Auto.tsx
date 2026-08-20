import React from 'react';
import type { ViewStyle } from 'react-native';

import { Sprite, type SpriteSize } from './Sprite';

export function Auto({ size, style }: { size?: SpriteSize; style?: ViewStyle }) {
  return <Sprite id="auto" size={size} style={style} />;
}
