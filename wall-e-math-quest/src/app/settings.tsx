import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { useGameState } from '@/hooks/useGameState';
import { MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';
import { MAX_NAME_LENGTH } from '@/utils/storage';

/** Screen 5 — Settings (PRD Section 10). Everything is local; no account. */
export default function SettingsScreen() {
  const { status, state, updateSettings, renamePlayer, resetProgress } = useGameState();
  const router = useRouter();
  const [draftName, setDraftName] = useState(state?.profile.name ?? '');

  if (status === 'no-profile' || status === 'load-error') return <Redirect href="/" />;
  if (!state) return null;

  const confirmReset = () => {
    Alert.alert('Reset Progress', 'This will erase all progress. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase',
        style: 'destructive',
        onPress: async () => {
          await resetProgress();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close settings"
          onPress={() => router.back()}
          style={styles.close}
          hitSlop={8}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>PLAYER NAME</Text>
        <TextInput
          value={draftName}
          onChangeText={(text) => setDraftName(text.slice(0, MAX_NAME_LENGTH))}
          onBlur={() => {
            if (draftName.trim().length > 0) void renamePlayer(draftName);
            else setDraftName(state.profile.name);
          }}
          maxLength={MAX_NAME_LENGTH}
          style={styles.input}
          accessibilityLabel="Player name"
          returnKeyType="done"
        />

        <Row
          label="Sound"
          value={state.settings.soundEnabled}
          onChange={(soundEnabled) => void updateSettings({ soundEnabled })}
        />
        <Row
          label="Music"
          value={state.settings.musicEnabled}
          onChange={(musicEnabled) => void updateSettings({ musicEnabled })}
        />

        <View style={styles.spacer} />

        <Button label="Reset Progress" variant="danger" onPress={confirmReset} />
        <Text style={styles.footnote}>
          Progress is stored on this device only. Resetting cannot be undone.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.eveGreen, false: colors.locked }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.charcoal },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { ...typography.heading, color: colors.textOnDark, flex: 1 },
  close: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.pill,
    backgroundColor: colors.soil,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 20, color: colors.textOnDark },
  content: { padding: spacing.lg, gap: spacing.md },
  label: { ...typography.label, color: colors.dust },
  input: {
    ...typography.subheading,
    color: colors.textOnLight,
    backgroundColor: colors.eveWhite,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH_TARGET + 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.soil,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH_TARGET + 12,
  },
  rowLabel: { ...typography.subheading, color: colors.textOnDark },
  spacer: { height: spacing.lg },
  footnote: { fontSize: 13, fontWeight: '600', color: colors.dust, textAlign: 'center' },
});
