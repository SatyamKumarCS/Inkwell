import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { gateHref, onboardingGates } from '@/features/auth/gate';
import { useGate, useSessionListener } from '@/features/auth/session';
import { initFirebase } from '@/lib/firebase';

initFirebase();
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { theme } = useUnistyles();
  useSessionListener();
  const gate = useGate();
  const redirectTo = gateHref(gate);

  useEffect(() => {
    if (gate !== 'initializing') SplashScreen.hide();
  }, [gate]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      {/* Exactly one group is available per gate; every guard redirects to that gate's route (gateHref). */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Protected
          guard={gate === 'initializing' || gate === 'loadingProfile'}
          redirectTo={redirectTo}
        >
          <Stack.Screen name="loading" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={gate === 'signedOut'} redirectTo={redirectTo}>
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={onboardingGates.includes(gate)} redirectTo={redirectTo}>
          <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={gate === 'ready'} redirectTo={redirectTo}>
          <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
