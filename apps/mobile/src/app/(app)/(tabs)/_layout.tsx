import { Tabs } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

import { FloatingTabBar } from '@/features/navigation/FloatingTabBar';

// SDK 58: the group's default screen (formerly initialRouteName).
export const unstable_settings = { anchor: 'index' };

export default function TabsLayout() {
  const { theme } = useUnistyles();
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
    </Tabs>
  );
}
