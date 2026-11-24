import { Stack } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

// SDK 58: the group's default screen (formerly initialRouteName).
export const unstable_settings = { anchor: 'sign-in' };

export default function AuthLayout() {
  const { theme } = useUnistyles();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="verify" />
    </Stack>
  );
}
