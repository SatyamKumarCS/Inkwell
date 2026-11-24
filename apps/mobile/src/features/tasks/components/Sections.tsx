import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Skeleton, Text } from '@/components';
import { haptics } from '@/lib/haptics';

export interface GroupHeaderProps {
  title: string;
  /** Open tasks in the group; hidden when 0. */
  count?: number;
  collapsed?: boolean;
  onToggle?: () => void;
}

/** Group title ("Inbox", "📋 Work", "26 Nov · Tomorrow"), optionally collapsible. */
export function GroupHeader({ title, count, collapsed = false, onToggle }: GroupHeaderProps) {
  const { theme } = useUnistyles();
  const Chevron = collapsed ? ChevronRight : ChevronDown;

  return (
    <Pressable
      accessibilityRole={onToggle ? 'button' : 'header'}
      accessibilityLabel={title}
      accessibilityState={onToggle ? { expanded: !collapsed } : undefined}
      disabled={!onToggle}
      onPress={() => {
        void haptics.selection();
        onToggle?.();
      }}
      style={styles.header}
    >
      <Text variant="title3" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {count ? (
        <Text variant="subhead" color="textTertiary">
          {count}
        </Text>
      ) : null}
      {onToggle ? <Chevron size={theme.iconSize.md} color={theme.colors.textTertiary} /> : null}
    </Pressable>
  );
}

/** "Completed · 3" — collapsed by default; done tasks sink here. */
export function CompletedSection({ count, children }: { count: number; children: ReactNode }) {
  const { theme } = useUnistyles();
  const [expanded, setExpanded] = useState(false);
  if (count === 0) return null;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <View style={styles.completed}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Completed, ${count}`}
        accessibilityState={{ expanded }}
        onPress={() => {
          void haptics.selection();
          setExpanded((v) => !v);
        }}
        style={styles.completedHeader}
      >
        <Text variant="subhead" color="textSecondary">
          Completed · {count}
        </Text>
        <Chevron size={theme.iconSize.sm} color={theme.colors.textSecondary} />
      </Pressable>
      {expanded ? children : null}
    </View>
  );
}

/** Placeholder rows while tasks load. */
export function TaskSkeleton({ rows = 5 }: { rows?: number }) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.skeleton} accessibilityLabel="Loading tasks">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={theme.iconSize.lg} height={theme.iconSize.lg} radius={theme.radii.sm} />
          <Skeleton width={`${85 - ((i * 17) % 40)}%`} height={18} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
    minHeight: theme.hitTarget,
  },
  title: {
    flexShrink: 1,
  },
  completed: {
    marginTop: theme.spacing.md,
  },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: theme.hitTarget,
  },
  skeleton: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
}));
