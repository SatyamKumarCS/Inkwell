import { Stack } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

// SDK 58: the group's default screen (formerly initialRouteName).
export const unstable_settings = { anchor: 'index' };

// The bottom tab bar (Home, Tasks, Calendar, Assistant, Space) arrives with Phase 2.
export default function AppLayout() {
  const { theme } = useUnistyles();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Protected guard={__DEV__}>
        <Stack.Screen name="dev" />
      </Stack.Protected>
    </Stack>
  );
}
