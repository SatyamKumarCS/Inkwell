import {
  CalendarDays,
  ClipboardList,
  Inbox,
  Sunrise,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from '@/components';
import { haptics } from '@/lib/haptics';

import type { TaskFilter } from '../dates';

export const FILTERS: { key: TaskFilter; label: string; icon: LucideIcon }[] = [
  { key: 'inbox', label: 'Inbox', icon: Inbox },
  { key: 'today', label: 'Today', icon: Sunrise },
  { key: 'upcoming', label: 'Upcoming', icon: CalendarDays },
  { key: 'all', label: 'All Tasks', icon: ClipboardList },
];

/** Inbox / Today / Upcoming / All Tasks. The selected chip shows its label; the others are icon-only. */
export function FilterChips({
  value,
  onChange,
}: {
  value: TaskFilter;
  onChange: (filter: TaskFilter) => void;
}) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.row} accessibilityRole="tablist">
      {FILTERS.map(({ key, label, icon: Icon }) => {
        const selected = key === value;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              void haptics.selection();
              onChange(key);
            }}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              size={theme.iconSize.md}
              color={selected ? theme.colors.accent : theme.colors.textSecondary}
            />
            {selected ? (
              <Text variant="headline" color="accent" numberOfLines={1}>
                {label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  chip: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    minHeight: theme.hitTarget,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceMuted,
  },
  chipSelected: {
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.accentSoft,
  },
  pressed: {
    opacity: 0.7,
  },
}));
