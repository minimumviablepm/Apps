import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Sprite } from '@/components/characters/Sprite';
import { SpeechBubble } from '@/components/characters/SpeechBubble';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { getTier } from '@/data/tiers';
import { useGameState } from '@/hooks/useGameState';
import { colors, radii, spacing, typography } from '@/theme';
import { PASS_THRESHOLD } from '@/utils/progressionEngine';

/** Screen 4 — Score screen (PRD Section 10). */
export default function ScoreScreen() {
  const params = useLocalSearchParams<{
    tierId?: string;
    score?: string;
    total?: string;
    percentage?: string;
    stars?: string;
    unlocked?: string;
  }>();
  const router = useRouter();
  const { saveWarning } = useGameState();

  const tierId = Number(params.tierId ?? 1);
  const score = Number(params.score ?? 0);
  const total = Number(params.total ?? 0);
  const percentage = Number(params.percentage ?? 0);
  const stars = Number(params.stars ?? 0);
  const unlockedTierId = params.unlocked ? Number(params.unlocked) : null;

  const passed = percentage >= PASS_THRESHOLD;
  const perfect = total > 0 && score === total;

  // The unlock celebration plays first, then the score details (PRD Screen 4).
  const [showUnlock, setShowUnlock] = useState(Boolean(unlockedTierId));
  useEffect(() => {
    if (!unlockedTierId) return undefined;
    const id = setTimeout(() => setShowUnlock(false), 2600);
    return () => clearTimeout(id);
  }, [unlockedTierId]);

  const headline =
    total === 0
      ? "Let's try again!"
      : perfect
        ? 'Perfect!'
        : passed
          ? 'Great round!'
          : 'Good effort!';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.tier}>{getTier(tierId).label}</Text>
        <Text style={styles.headline}>{headline}</Text>

        <Animated.View entering={ZoomIn.delay(150)} style={styles.scoreCard}>
          <Text style={styles.scoreValue}>
            {score} <Text style={styles.scoreOutOf}>out of {total}</Text>
          </Text>
          <Text style={styles.percentage}>{percentage}%</Text>
          <StarRating rating={stars} size={44} />
        </Animated.View>

        <View style={styles.characters}>
          <View style={styles.characterColumn}>
            <SpeechBubble
              text={passed ? 'You found me!' : "Let's find Eve next time!"}
              tone={passed ? 'good' : 'neutral'}
            />
            <View style={styles.spriteRow}>
              <Sprite id="walle" size={perfect ? 'lg' : 'md'} />
              {passed ? <Sprite id="eve" size={perfect ? 'lg' : 'md'} /> : null}
            </View>
            {perfect ? <Text style={styles.perfect}>Wall-E and Eve are dancing! ✨</Text> : null}
          </View>
        </View>

        {saveWarning ? (
          <Text style={styles.saveWarning}>Progress might not have saved.</Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label="Play Again"
            onPress={() => router.replace({ pathname: '/round', params: { tierId: String(tierId) } })}
          />
          <Button
            label="Level Map"
            variant="secondary"
            onPress={() =>
              router.replace({
                pathname: '/level-map',
                params: unlockedTierId ? { unlocked: String(unlockedTierId) } : {},
              })
            }
          />
        </View>
      </View>

      {showUnlock && unlockedTierId ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.overlay}>
          <Animated.View entering={ZoomIn} style={styles.unlockCard}>
            <Text style={styles.unlockKicker}>NEW LEVEL UNLOCKED</Text>
            <Text style={styles.unlockTitle}>{getTier(unlockedTierId).label}</Text>
            <Sprite id="eve" size="lg" />
          </Animated.View>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.charcoal },
  content: { flex: 1, padding: spacing.lg, alignItems: 'center', gap: spacing.md },
  tier: { ...typography.label, color: colors.dust },
  headline: { ...typography.title, color: colors.textOnDark, textAlign: 'center' },
  scoreCard: {
    backgroundColor: colors.soil,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  scoreValue: { ...typography.title, color: colors.textOnDark },
  scoreOutOf: { ...typography.subheading, color: colors.dust },
  percentage: { ...typography.heading, color: colors.eveGlow },
  characters: { flex: 1, justifyContent: 'center' },
  characterColumn: { alignItems: 'center', gap: spacing.md },
  spriteRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' },
  perfect: { ...typography.body, color: colors.star },
  saveWarning: { fontSize: 13, fontWeight: '600', color: colors.warning, textAlign: 'center' },
  actions: { width: '100%', gap: spacing.sm },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockCard: {
    backgroundColor: colors.eveDeep,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 4,
    borderColor: colors.star,
  },
  unlockKicker: { ...typography.label, color: colors.star },
  unlockTitle: { ...typography.heading, color: colors.textOnDark, textAlign: 'center' },
});
