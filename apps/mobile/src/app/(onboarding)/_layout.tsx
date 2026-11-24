import { Stack } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

import { gateHref } from '@/features/auth/gate';
import { useGate } from '@/features/auth/session';

/** One step at a time: finishing a step updates the profile, the gate moves on, and so does the router. */
export default function OnboardingLayout() {
  const { theme } = useUnistyles();
  const gate = useGate();
  const redirectTo = gateHref(gate);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Protected guard={gate === 'needsProfile'} redirectTo={redirectTo}>
        <Stack.Screen name="name" />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'needsTour'} redirectTo={redirectTo}>
        <Stack.Screen name="tour" />
      </Stack.Protected>
      <Stack.Protected guard={gate === 'needsNotifications'} redirectTo={redirectTo}>
        <Stack.Screen name="notifications" />
      </Stack.Protected>
    </Stack>
  );
}
