import React from 'react';
import type { ViewStyle } from 'react-native';

import { Sprite, type SpriteSize } from './Sprite';

export function WallE({ size, style }: { size?: SpriteSize; style?: ViewStyle }) {
  return <Sprite id="walle" size={size} style={style} />;
}
