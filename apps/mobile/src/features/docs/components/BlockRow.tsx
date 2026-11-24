import { Check } from 'lucide-react-native';
import type { ComponentRef, Ref } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from '@/components';

import type { EditorBlock } from '../blocks';

interface BlockRowProps {
  block: EditorBlock;
  /** Position within a numbered list (1-based). */
  number: number;
  editable: boolean;
  inputRef: Ref<ComponentRef<typeof TextInput>>;
  onChangeText: (text: string) => void;
  /** Enter: split the block at the cursor. */
  onEnter: () => void;
  onSelectionChange: (cursor: number) => void;
  onToggle: () => void;
  onBackspaceEmpty: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

const PLACEHOLDERS: Partial<Record<EditorBlock['type'], string>> = {
  heading: 'Heading',
  todo: 'To-do',
  bullet: 'List',
  numbered: 'List',
  quote: 'Quote',
};

/** One editable block: a marker (checkbox, bullet, number, quote bar) and a multiline text input. */
export function BlockRow({
  block,
  number,
  editable,
  inputRef,
  onChangeText,
  onEnter,
  onSelectionChange,
  onToggle,
  onBackspaceEmpty,
  onFocus,
  onBlur,
}: BlockRowProps) {
  const { theme } = useUnistyles();

  if (block.type === 'divider') {
    return (
      <Pressable accessibilityLabel="Divider" onLongPress={onBackspaceEmpty} style={styles.dividerRow}>
        <View style={styles.divider} />
      </Pressable>
    );
  }

  return (
    <View style={[styles.row, block.type === 'quote' && styles.quote]}>
      {block.type === 'todo' ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: block.checked }}
          accessibilityLabel={block.text || 'To-do'}
          onPress={onToggle}
          hitSlop={8}
          style={[styles.checkbox, block.checked && styles.checkboxOn]}
        >
          {block.checked ? (
            <Check size={theme.iconSize.sm} color={theme.colors.onAccent} strokeWidth={3} />
          ) : null}
        </Pressable>
      ) : block.type === 'bullet' ? (
        <Text style={styles.marker}>•</Text>
      ) : block.type === 'numbered' ? (
        <Text style={styles.marker}>{number}.</Text>
      ) : null}
      <TextInput
        // A new type (e.g. after a markdown shortcut) remounts the input, so Android shows the new text
        // instead of keeping what was typed.
        key={block.type}
        ref={inputRef}
        value={block.text}
        editable={editable}
        multiline
        scrollEnabled={false}
        // Enter submits instead of inserting a newline: a controlled multiline input on Android keeps a typed
        // newline when the value it is reset to is unchanged, so blocks are split here instead.
        submitBehavior="submit"
        onSubmitEditing={onEnter}
        onSelectionChange={({ nativeEvent }) => onSelectionChange(nativeEvent.selection.start)}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyPress={({ nativeEvent }) => {
          if (nativeEvent.key === 'Backspace' && block.text === '') onBackspaceEmpty();
        }}
        placeholder={PLACEHOLDERS[block.type]}
        placeholderTextColor={theme.colors.textTertiary}
        style={[styles.input(block.type), block.type === 'todo' && block.checked && styles.done]}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accent,
    paddingLeft: theme.spacing.md,
  },
  input: (type: EditorBlock['type']) => ({
    flex: 1,
    padding: 0,
    paddingVertical: theme.spacing.xs,
    color: theme.colors.text,
    textAlignVertical: 'top' as const,
    ...(type === 'heading'
      ? theme.typography.title2
      : type === 'quote'
        ? { ...theme.typography.body, fontStyle: 'italic' as const }
        : theme.typography.body),
    ...(type === 'heading' ? { marginTop: theme.spacing.sm, color: theme.colors.accent } : {}),
  }),
  done: {
    color: theme.colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  marker: {
    minWidth: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
    color: theme.colors.textSecondary,
  },
  checkbox: {
    width: 22,
    height: 22,
    marginTop: theme.spacing.xs,
    borderRadius: theme.radii.sm - 2,
    borderWidth: 2,
    borderColor: theme.colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  dividerRow: {
    paddingVertical: theme.spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
}));
