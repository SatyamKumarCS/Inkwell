import { Stack } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

export const unstable_settings = { initialRouteName: 'index' };

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
