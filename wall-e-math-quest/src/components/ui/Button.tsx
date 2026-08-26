import React from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const BACKGROUNDS: Record<ButtonVariant, string> = {
  primary: colors.eveGreen,
  secondary: colors.dust,
  danger: colors.wrong,
  ghost: 'transparent',
};

const LABEL_COLORS: Record<ButtonVariant, string> = {
  primary: '#FFFFFF',
  secondary: colors.charcoal,
  danger: '#FFFFFF',
  ghost: colors.textOnDark,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: BACKGROUNDS[variant] },
        variant === 'ghost' && styles.ghost,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, { color: LABEL_COLORS[variant] }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_TARGET + 8,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    borderWidth: 2,
    borderColor: colors.dust,
  },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  disabled: { opacity: 0.45 },
  label: { ...typography.subheading, textAlign: 'center' },
});
