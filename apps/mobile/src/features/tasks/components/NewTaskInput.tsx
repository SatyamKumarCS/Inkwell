import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { haptics } from '@/lib/haptics';

export interface NewTaskInputProps {
  placeholder?: string;
  /** Called with the trimmed title; the input clears and keeps focus for the next task. */
  onCreate: (title: string) => void;
  disabled?: boolean;
  maxLength?: number;
}

/** Inline "+ New task" field that creates on submit. */
export function NewTaskInput({
  placeholder = 'New task',
  onCreate,
  disabled = false,
  maxLength = 1000,
}: NewTaskInputProps) {
  const { theme } = useUnistyles();
  const [text, setText] = useState('');

  const submit = () => {
    const title = text.trim();
    if (!title) return;
    void haptics.selection();
    onCreate(title);
    setText('');
  };

  return (
    <View style={styles.row}>
      <Plus size={theme.iconSize.lg} color={theme.colors.textTertiary} />
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        submitBehavior="submit"
        returnKeyType="done"
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        selectionColor={theme.colors.accent}
        accessibilityLabel={placeholder}
        editable={!disabled}
        maxLength={maxLength}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: theme.hitTarget,
  },
  input: {
    ...theme.typography.body,
    flex: 1,
    color: theme.colors.text,
    paddingVertical: theme.spacing.sm,
  },
}));
