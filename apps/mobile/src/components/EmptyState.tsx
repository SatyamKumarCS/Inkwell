import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

/** Used for empty lists and, with a retry action, for error and offline states. */
export function EmptyState({
  icon: Icon,
  title,
  message,
  actionLabel,
  onActionPress,
}: EmptyStateProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      {Icon ? <Icon size={theme.iconSize.xl} color={theme.colors.textTertiary} /> : null}
      <Text variant="headline" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="subhead" color="textSecondary" align="center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onActionPress ? (
        <Button label={actionLabel} variant="secondary" onPress={onActionPress} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
  },
}));
