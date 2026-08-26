import React from 'react';
import type { ViewStyle } from 'react-native';

import type { WrongAnswerCharacterId } from '@/types';
import { Sprite, type SpriteSize } from './Sprite';

/** The three reject bots share one component; the id picks which one. */
export type RejectBotId = Extract<WrongAnswerCharacterId, 'vaqm' | 'dfib' | 'brla'>;

export function RejectBot({
  id,
  size,
  style,
}: {
  id: RejectBotId;
  size?: SpriteSize;
  style?: ViewStyle;
}) {
  return <Sprite id={id} size={size} style={style} />;
}
