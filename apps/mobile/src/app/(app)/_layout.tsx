import { Stack } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

import { useSession } from '@/features/auth/session';
import { useDocsSync } from '@/features/docs/api';
import { useThemePreference } from '@/features/settings/api';
import { useTasksSync } from '@/features/tasks/api';

// SDK 58: the group's default screen (formerly initialRouteName).
export const unstable_settings = { anchor: '(tabs)' };

export default function AppLayout() {
  const { theme } = useUnistyles();
  const uid = useSession((s) => s.uid);
  const spaceId = useSession((s) => s.profile?.defaultSpaceId);
  useThemePreference(useSession((s) => s.profile?.settings.theme));

  return (
    <>
      {uid && spaceId ? <DataSync uid={uid} spaceId={spaceId} /> : null}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="doc/[id]" />
        <Stack.Screen name="docs" />
        <Stack.Screen name="task/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="dev" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

/** The signed-in user's docs, stars, tasks and lists: one listener each for the whole app. */
function DataSync({ uid, spaceId }: { uid: string; spaceId: string }) {
  useDocsSync(uid, spaceId);
  useTasksSync(uid, spaceId);
  return null;
}
