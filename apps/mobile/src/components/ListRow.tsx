import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function ListRow({
  title,
  subtitle,
  icon: Icon,
  trailing,
  showChevron = false,
  destructive = false,
  onPress,
  onLongPress,
}: ListRowProps) {
  const { theme } = useUnistyles();
  const interactive = Boolean(onPress || onLongPress);

  return (
    <Pressable
      accessibilityRole={interactive ? 'button' : undefined}
      disabled={!interactive}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {Icon ? (
        <Icon
          size={theme.iconSize.md}
          color={destructive ? theme.colors.danger : theme.colors.textSecondary}
        />
      ) : null}
      <View style={styles.body}>
        <Text color={destructive ? 'danger' : 'text'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {showChevron ? (
        <ChevronRight size={theme.iconSize.md} color={theme.colors.textTertiary} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: theme.hitTarget + theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  pressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  body: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
}));
