import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Sprite } from '@/components/characters/Sprite';
import { Button } from '@/components/ui/Button';
import { MAX_AGE, MIN_AGE, getTier, tierForAge } from '@/data/tiers';
import { useGameState } from '@/hooks/useGameState';
import { MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';
import { MAX_NAME_LENGTH } from '@/utils/storage';

const AGES = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i);

/** Screen 1 — Profile Setup, and the app's entry point (PRD Section 10). */
export default function ProfileSetupScreen() {
  const { status, createProfile, startFresh } = useGameState();
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const wave = useSharedValue(0);
  useEffect(() => {
    wave.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 500, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [wave]);

  const waveStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-8 + wave.value * 16}deg` }, { translateY: -wave.value * 4 }],
  }));

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.eveGreen} size="large" />
      </SafeAreaView>
    );
  }

  if (status === 'load-error') {
    // PRD Section 15 — AsyncStorage read failure.
    return (
      <SafeAreaView style={styles.centered}>
        <Sprite id="walle" size="lg" />
        <Text style={styles.errorText}>Oops! Something went wrong loading your progress.</Text>
        <Button label="Start Fresh" onPress={startFresh} />
      </SafeAreaView>
    );
  }

  if (status === 'ready') return <Redirect href="/level-map" />;

  const canSubmit = name.trim().length > 0 && age !== null && !submitting;

  const submit = async () => {
    if (age === null || !canSubmit) return;
    setSubmitting(true);
    await createProfile(name, age);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View style={waveStyle}>
          <Sprite id="walle" size="lg" />
        </Animated.View>

        <Text style={styles.title}>Wall-E Math Quest</Text>
        <Text style={styles.subtitle}>Help Wall-E find Eve behind the doors!</Text>

        <Text style={styles.label}>WHAT'S YOUR NAME?</Text>
        <TextInput
          value={name}
          onChangeText={(text) => setName(text.slice(0, MAX_NAME_LENGTH))}
          placeholder="Your name"
          placeholderTextColor={colors.locked}
          maxLength={MAX_NAME_LENGTH}
          style={styles.input}
          accessibilityLabel="Player name"
          returnKeyType="done"
        />

        <Text style={styles.label}>HOW OLD ARE YOU?</Text>
        <View style={styles.ageGrid}>
          {AGES.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`Age ${value}`}
              accessibilityState={{ selected: age === value }}
              onPress={() => setAge(value)}
              style={[styles.ageChip, age === value && styles.ageChipActive]}
            >
              <Text style={[styles.ageText, age === value && styles.ageTextActive]}>{value}</Text>
            </Pressable>
          ))}
        </View>

        {age !== null ? (
          <Text style={styles.tierHint}>
            You'll start as a {getTier(tierForAge(age)).label}!
          </Text>
        ) : null}

        <Button label="Let's Go!" onPress={submit} disabled={!canSubmit} style={styles.cta} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.charcoal },
  centered: {
    flex: 1,
    backgroundColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  content: { padding: spacing.lg, alignItems: 'center', gap: spacing.md },
  title: { ...typography.title, color: colors.textOnDark, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.dust, textAlign: 'center' },
  errorText: { ...typography.subheading, color: colors.textOnDark, textAlign: 'center' },
  label: { ...typography.label, color: colors.dust, marginTop: spacing.md },
  input: {
    ...typography.subheading,
    color: colors.textOnLight,
    backgroundColor: colors.eveWhite,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH_TARGET + 8,
    width: '100%',
  },
  ageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  ageChip: {
    width: MIN_TOUCH_TARGET + 16,
    height: MIN_TOUCH_TARGET + 16,
    borderRadius: radii.pill,
    backgroundColor: colors.soil,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  ageChipActive: { backgroundColor: colors.eveGreen, borderColor: colors.eveGlow },
  ageText: { ...typography.subheading, color: colors.textOnDark },
  ageTextActive: { color: '#FFFFFF' },
  tierHint: { ...typography.body, color: colors.eveGlow, textAlign: 'center' },
  cta: { marginTop: spacing.md, minWidth: 200 },
});
