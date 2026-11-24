import { ListPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, Text, TextField } from '@/components';
import { haptics } from '@/lib/haptics';

/** "New list" row that expands into an inline name field (Alert.prompt doesn't exist on Android). */
export function NewListInput({ onCreate }: { onCreate: (name: string) => void }) {
  const { theme } = useUnistyles();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setEditing(false);
      return;
    }
    void haptics.success();
    onCreate(trimmed);
    setName('');
    setEditing(false);
  };

  if (!editing) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setEditing(true)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <ListPlus size={theme.iconSize.lg} color={theme.colors.accent} />
        <Text color="accent">New list</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.editor}>
      <TextField
        label="List name"
        value={name}
        onChangeText={setName}
        onSubmitEditing={submit}
        onBlur={() => {
          if (!name.trim()) setEditing(false);
        }}
        placeholder="e.g. Work"
        returnKeyType="done"
        maxLength={100}
        autoFocus
      />
      <View style={styles.actions}>
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => {
            setName('');
            setEditing(false);
          }}
        />
        <Button label="Create list" onPress={submit} disabled={!name.trim()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: theme.hitTarget,
    marginTop: theme.spacing.lg,
    borderRadius: theme.radii.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  editor: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
}));
