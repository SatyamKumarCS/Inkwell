import {
  ChevronDown,
  Heading1,
  List,
  ListOrdered,
  Minus,
  Quote,
  SquareCheck,
  Type,
  type LucideIcon,
} from 'lucide-react-native';
import { Keyboard, Pressable, ScrollView, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { EditorBlockType } from '../blocks';

const TOOLS: { type: EditorBlockType; icon: LucideIcon; label: string }[] = [
  { type: 'paragraph', icon: Type, label: 'Text' },
  { type: 'heading', icon: Heading1, label: 'Heading' },
  { type: 'todo', icon: SquareCheck, label: 'To-do' },
  { type: 'bullet', icon: List, label: 'Bulleted list' },
  { type: 'numbered', icon: ListOrdered, label: 'Numbered list' },
  { type: 'quote', icon: Quote, label: 'Quote' },
  { type: 'divider', icon: Minus, label: 'Divider' },
];

/** Shown above the keyboard while a block is focused: turns the block into another type. */
export function BlockToolbar({
  current,
  onSelect,
}: {
  current: EditorBlockType;
  onSelect: (type: EditorBlockType) => void;
}) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.bar}>
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tools}
      >
        {TOOLS.map(({ type, icon: Icon, label }) => {
          const active = type === current;
          return (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(type)}
              style={[styles.tool, active && styles.toolActive]}
            >
              <Icon size={theme.iconSize.md} color={active ? theme.colors.accent : theme.colors.text} />
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hide keyboard"
        onPress={() => Keyboard.dismiss()}
        style={styles.tool}
      >
        <ChevronDown size={theme.iconSize.md} color={theme.colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  tools: {
    gap: theme.spacing.xs,
  },
  tool: {
    width: theme.hitTarget,
    height: theme.hitTarget,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolActive: {
    backgroundColor: theme.colors.accentSoft,
  },
}));
