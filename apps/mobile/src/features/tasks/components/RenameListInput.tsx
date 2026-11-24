import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, TextField } from '@/components';

/** Inline rename field for a list header (Alert.prompt doesn't exist on Android). */
export function RenameListInput({
  initialName,
  onSave,
  onCancel,
}: {
  initialName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const submit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== initialName) onSave(trimmed);
    else onCancel();
  };
  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <TextField
          value={name}
          onChangeText={setName}
          autoFocus
          maxLength={100}
          returnKeyType="done"
          onSubmitEditing={submit}
          accessibilityLabel="List name"
        />
      </View>
      <Button label="Save" size="md" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  field: {
    flex: 1,
  },
}));
