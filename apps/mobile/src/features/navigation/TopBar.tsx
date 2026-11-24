import { useRouter } from 'expo-router';
import { ChevronLeft, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export interface TopBarAction {
  icon: LucideIcon;
  accessibilityLabel: string;
  onPress: () => void;
  /** Highlights the icon (e.g. a starred doc). */
  active?: boolean;
}

interface TopBarProps {
  /** Shows a round back button (or `left` replaces it). */
  back?: boolean;
  left?: ReactNode;
  actions?: TopBarAction[];
}

/** The floating top row: a round back button on the left, a pill of actions on the right. */
export function TopBar({ back = false, left, actions = [] }: TopBarProps) {
  const { theme } = useUnistyles();
  const router = useRouter();
  return (
    <View style={styles.row}>
      {left ??
        (back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          >
            <ChevronLeft size={theme.iconSize.lg} color={theme.colors.text} />
          </Pressable>
        ) : (
          <View />
        ))}
      {actions.length > 0 ? (
        <View style={styles.pill}>
          {actions.map(({ icon: Icon, accessibilityLabel, onPress, active }) => (
            <Pressable
              key={accessibilityLabel}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              accessibilityState={active === undefined ? undefined : { selected: active }}
              onPress={onPress}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Icon
                size={theme.iconSize.md}
                color={active ? theme.colors.accent : theme.colors.text}
                fill={active ? theme.colors.accent : 'transparent'}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm,
    minHeight: theme.hitTarget + theme.spacing.sm,
  },
  round: {
    width: theme.hitTarget + theme.spacing.xs,
    height: theme.hitTarget + theme.spacing.xs,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pill: {
    flexDirection: 'row',
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xxs,
  },
  action: {
    width: theme.hitTarget,
    height: theme.hitTarget,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
}));
