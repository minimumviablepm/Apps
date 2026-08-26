import { Link, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { StarRating } from '@/components/ui/StarRating';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TIERS } from '@/data/tiers';
import { useGameState } from '@/hooks/useGameState';
import { useSound } from '@/hooks/useSound';
import { MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';
import { PASSES_TO_UNLOCK, roundsUntilUnlock } from '@/utils/progressionEngine';

/** Screen 2 — Level Map (PRD Section 10). */
export default function LevelMapScreen() {
  const { status, state } = useGameState();
  const { play } = useSound();
  const router = useRouter();
  const params = useLocalSearchParams<{ unlocked?: string }>();
  const [tooltipTier, setTooltipTier] = useState<number | null>(null);

  const unlockedTierId = params.unlocked ? Number(params.unlocked) : null;

  useEffect(() => {
    if (unlockedTierId) play('tier_unlock');
  }, [unlockedTierId, play]);

  const currentTierId = useMemo(() => {
    if (!state) return 1;
    const unlocked = state.tiers.filter((t) => t.isUnlocked);
    return unlocked.length > 0 ? Math.max(...unlocked.map((t) => t.tierId)) : 1;
  }, [state]);

  if (status === 'no-profile' || status === 'load-error') return <Redirect href="/" />;
  if (!state) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.hello} numberOfLines={1}>
            Hi {state.profile.name}!
          </Text>
          <Text style={styles.subtitle}>Pick a level to play</Text>
        </View>
        <Link href="/settings" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={styles.gear}
            hitSlop={8}
          >
            <Text style={styles.gearIcon}>⚙︎</Text>
          </Pressable>
        </Link>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {TIERS.map((tier) => {
          const progress = state.tiers.find((t) => t.tierId === tier.tierId);
          if (!progress) return null;
          const isCurrent = tier.tierId === currentTierId;
          const previous = TIERS.find((t) => t.tierId === tier.tierId - 1);

          return (
            <View key={tier.tierId}>
              <TierNode
                tierId={tier.tierId}
                label={tier.label}
                ages={`Ages ${tier.minAge}-${tier.maxAge}`}
                isUnlocked={progress.isUnlocked}
                justUnlocked={unlockedTierId === tier.tierId}
                bestScore={progress.bestScore}
                stars={progress.starRating}
                roundsPlayed={progress.totalRoundsPlayed}
                consecutivePasses={progress.consecutivePasses}
                showAvatar={isCurrent}
                onPress={() => {
                  if (progress.isUnlocked) {
                    router.push({ pathname: '/round', params: { tierId: String(tier.tierId) } });
                  } else {
                    setTooltipTier(tier.tierId === tooltipTier ? null : tier.tierId);
                  }
                }}
              />
              {tooltipTier === tier.tierId && !progress.isUnlocked ? (
                <View style={styles.tooltip}>
                  <Text style={styles.tooltipText}>
                    Score 70% on {PASSES_TO_UNLOCK} rounds in {previous?.label ?? 'the level before'}{' '}
                    to unlock!
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function TierNode({
  tierId,
  label,
  ages,
  isUnlocked,
  justUnlocked,
  bestScore,
  stars,
  roundsPlayed,
  consecutivePasses,
  showAvatar,
  onPress,
}: {
  tierId: number;
  label: string;
  ages: string;
  isUnlocked: boolean;
  justUnlocked: boolean;
  bestScore: number;
  stars: number;
  roundsPlayed: number;
  consecutivePasses: number;
  showAvatar: boolean;
  onPress: () => void;
}) {
  const pulse = useSharedValue(0);
  const unlockSpin = useSharedValue(0);

  useEffect(() => {
    if (showAvatar && isUnlocked) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [showAvatar, isUnlocked, pulse]);

  useEffect(() => {
    // PRD Screen 2 — the padlock animates from locked to unlocked.
    if (justUnlocked) {
      unlockSpin.value = withSequence(
        withTiming(1, { duration: 700, easing: Easing.out(Easing.back(2)) }),
        withTiming(0, { duration: 300 }),
      );
    }
  }, [justUnlocked, unlockSpin]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.02 + unlockSpin.value * 0.06 }],
    borderColor: justUnlocked ? colors.star : isUnlocked ? colors.eveGreen : colors.locked,
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${isUnlocked ? 'unlocked' : 'locked'}`}
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      <Animated.View style={[styles.node, !isUnlocked && styles.nodeLocked, cardStyle]}>
        <View style={styles.nodeBadge}>
          <Text style={styles.nodeBadgeText}>{isUnlocked ? tierId : '?'}</Text>
        </View>

        <View style={styles.nodeBody}>
          <Text style={styles.nodeTitle} numberOfLines={1}>
            {isUnlocked ? label : 'Locked'}
          </Text>
          <Text style={styles.nodeAges}>{ages}</Text>

          {isUnlocked ? (
            <>
              <View style={styles.nodeStats}>
                <StarRating rating={stars} size={20} />
                <Text style={styles.nodeBest}>
                  Best: {roundsPlayed === 0 ? '--' : bestScore}
                </Text>
              </View>
              <ProgressBar value={consecutivePasses} max={PASSES_TO_UNLOCK} height={8} />
              <Text style={styles.nodeHint}>
                {roundsUntilUnlock(consecutivePasses) === 0
                  ? 'Next level unlocked!'
                  : `${roundsUntilUnlock(consecutivePasses)} more good rounds to unlock the next level`}
              </Text>
            </>
          ) : (
            <Text style={styles.nodeHint}>Tap to see how to unlock</Text>
          )}
        </View>

        {showAvatar ? <Sprite id="walle" size="sm" style={styles.avatar} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.charcoal },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  hello: { ...typography.heading, color: colors.textOnDark },
  subtitle: { ...typography.body, color: colors.dust },
  gear: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.pill,
    backgroundColor: colors.soil,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: { fontSize: 22, color: colors.textOnDark },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.md },
  node: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.soil,
    borderRadius: radii.lg,
    borderWidth: 3,
    padding: spacing.md,
    minHeight: 108,
  },
  nodeLocked: { backgroundColor: '#3A332A', opacity: 0.75 },
  nodeBadge: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeBadgeText: { ...typography.heading, color: colors.textOnDark },
  nodeBody: { flex: 1, gap: 4 },
  nodeTitle: { ...typography.subheading, color: colors.textOnDark },
  nodeAges: { ...typography.label, color: colors.dust },
  nodeStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nodeBest: { ...typography.body, color: colors.textOnDark },
  nodeHint: { fontSize: 12, fontWeight: '600', color: colors.dust },
  avatar: { position: 'absolute', right: -6, top: -18 },
  tooltip: {
    marginTop: -spacing.xs,
    marginHorizontal: spacing.md,
    backgroundColor: colors.eveWhite,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  tooltipText: { ...typography.body, color: colors.textOnLight, textAlign: 'center' },
});
