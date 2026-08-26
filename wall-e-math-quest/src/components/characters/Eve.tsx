import React from 'react';
import type { ViewStyle } from 'react-native';

import { Sprite, type SpriteSize } from './Sprite';

export function Eve({ size, style }: { size?: SpriteSize; style?: ViewStyle }) {
  return <Sprite id="eve" size={size} style={style} />;
}
