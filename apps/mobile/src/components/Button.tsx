import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { ColorName } from '@/theme';

import { Text } from './Text';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
}

const labelColor: Record<ButtonVariant, ColorName> = {
  primary: 'onAccent',
  secondary: 'text',
  ghost: 'accent',
  destructive: 'danger',
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  fullWidth = false,
  disabled,
  ...rest
}: ButtonProps) {
  const { theme } = useUnistyles();
  const isDisabled = disabled || loading;
  styles.useVariants({ variant, size });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors[labelColor[variant]]} />
      ) : (
        <View style={styles.row}>
          {Icon ? (
            <Icon size={theme.iconSize.md} color={theme.colors[labelColor[variant]]} />
          ) : null}
          <Text variant="headline" color={labelColor[variant]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: {
    minHeight: theme.hitTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.xl,
    variants: {
      variant: {
        primary: { backgroundColor: theme.colors.accent },
        secondary: { backgroundColor: theme.colors.surfaceMuted },
        ghost: { backgroundColor: 'transparent' },
        destructive: { backgroundColor: theme.colors.dangerSoft },
      },
      size: {
        md: { minHeight: theme.hitTarget },
        lg: { minHeight: 52 },
      },
    },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
}));
