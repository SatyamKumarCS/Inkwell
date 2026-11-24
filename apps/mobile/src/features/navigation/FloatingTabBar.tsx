import { useRouter, type Tabs } from 'expo-router';
import { CalendarDays, House, Plus, SquareCheckBig, type LucideIcon } from 'lucide-react-native';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useSession } from '@/features/auth/session';
import { createDoc } from '@/features/docs/api';
import { haptics } from '@/lib/haptics';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, LucideIcon> = {
  index: House,
  tasks: SquareCheckBig,
  calendar: CalendarDays,
};

/** Height of the floating bar plus its gap, so scrolling content can clear it. */
export const TAB_BAR_SPACE = 104;

/** Floating pill with the three tabs, and a separate "new doc" button on the right. */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab, insets }: TabBarProps) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const uid = useSession((s) => s.uid);
  const spaceId = useSession((s) => s.profile?.defaultSpaceId);

  const newDoc = () => {
    if (!uid || !spaceId) return;
    void haptics.selection();
    const id = createDoc({ uid, spaceId });
    router.push({ pathname: '/doc/[id]', params: { id, isNew: '1' } });
  };

  return (
    <View style={[styles.bar, { bottom: insets.bottom + theme.spacing.sm }]} pointerEvents="box-none">
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name] ?? House;
          const label = descriptors[route.key]?.options.title ?? route.name;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = emitter.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  void haptics.selection();
                  navigateToTab(route.key);
                }
              }}
              style={[styles.tab, focused && styles.tabFocused]}
            >
              <Icon
                size={theme.iconSize.lg}
                color={focused ? theme.colors.accent : theme.colors.text}
                strokeWidth={focused ? 2.4 : 2}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.pill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New doc"
          onPress={newDoc}
          style={({ pressed }) => [styles.plus, pressed && styles.plusPressed]}
        >
          <Plus size={theme.iconSize.lg} color={theme.colors.onAccent} strokeWidth={2.6} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.xs,
    gap: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    boxShadow: theme.shadows.raised,
  },
  tab: {
    width: 72,
    height: theme.hitTarget + theme.spacing.md,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabFocused: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  plus: {
    width: theme.hitTarget + theme.spacing.md,
    height: theme.hitTarget + theme.spacing.md,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
  },
  plusPressed: {
    backgroundColor: theme.colors.accentPressed,
  },
}));
