import { Square, SquareCheck } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from '@/components';

export interface TaskRowProps {
  title: string;
  done: boolean;
  /** Small secondary line, e.g. the date or the list. */
  subtitle?: string;
  onToggle: () => void;
  onPress: () => void;
}

/** Square checkbox + title. Done tasks are checked, struck through and dimmed. */
export function TaskRow({ title, done, subtitle, onToggle, onPress }: TaskRowProps) {
  const { theme } = useUnistyles();
  const Icon = done ? SquareCheck : Square;
  const label = title.trim() || 'Untitled task';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the task"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={done ? `Mark "${label}" as not done` : `Mark "${label}" as done`}
        accessibilityState={{ checked: done }}
        hitSlop={theme.spacing.md}
        onPress={onToggle}
        style={styles.checkbox}
      >
        <Icon
          size={theme.iconSize.lg}
          color={done ? theme.colors.accent : theme.colors.textSecondary}
          strokeWidth={done ? 2.4 : 2}
        />
      </Pressable>
      <View style={styles.body}>
        <Text
          color={done ? 'textTertiary' : 'text'}
          numberOfLines={2}
          style={done ? styles.doneTitle : undefined}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text variant="footnote" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.sm,
  },
  pressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  checkbox: {
    paddingTop: theme.spacing.xxs / 2,
  },
  body: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  doneTitle: {
    textDecorationLine: 'line-through',
  },
}));
