import React from 'react';
import type { ViewStyle } from 'react-native';

import { Sprite, type SpriteSize } from './Sprite';

export function MO({ size, style }: { size?: SpriteSize; style?: ViewStyle }) {
  return <Sprite id="mo" size={size} style={style} />;
}
