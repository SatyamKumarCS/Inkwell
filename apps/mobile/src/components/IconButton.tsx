import type { LucideIcon } from 'lucide-react-native';
import { Pressable, type PressableProps } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { ColorName } from '@/theme';

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: LucideIcon;
  /** Required: icon-only buttons need a screen-reader label. */
  accessibilityLabel: string;
  color?: ColorName;
  filled?: boolean;
}

export function IconButton({
  icon: Icon,
  color = 'text',
  filled = false,
  ...rest
}: IconButtonProps) {
  const { theme } = useUnistyles();

  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={theme.spacing.xs}
      style={({ pressed }) => [styles.base, filled && styles.filled, pressed && styles.pressed]}
      {...rest}
    >
      <Icon size={theme.iconSize.lg} color={theme.colors[color]} />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: {
    width: theme.hitTarget,
    height: theme.hitTarget,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  pressed: {
    opacity: 0.6,
  },
}));
