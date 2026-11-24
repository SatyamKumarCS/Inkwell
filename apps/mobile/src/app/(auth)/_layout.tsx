import { Stack } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

export const unstable_settings = { initialRouteName: 'sign-in' };

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
