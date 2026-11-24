import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export interface CardProps extends ViewProps {
  children: ReactNode;
  /** Remove inner padding, e.g. for a card that contains ListRows. */
  flush?: boolean;
}

export function Card({ children, flush = false, style, ...rest }: CardProps) {
  return (
    <View style={[styles.card, flush ? styles.flush : undefined, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    boxShadow: theme.shadows.card,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.colors.border,
  },
  flush: {
    padding: 0,
    gap: 0,
    overflow: 'hidden',
  },
}));
