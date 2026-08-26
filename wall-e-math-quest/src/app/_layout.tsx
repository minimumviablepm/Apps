import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GameStateProvider } from '@/hooks/useGameState';
import { SoundProvider } from '@/hooks/useSound';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <GameStateProvider>
          <SoundProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.charcoal },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="level-map" />
              <Stack.Screen name="round" options={{ gestureEnabled: false }} />
              <Stack.Screen name="score" options={{ gestureEnabled: false }} />
              <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
            </Stack>
          </SoundProvider>
        </GameStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.charcoal },
});
