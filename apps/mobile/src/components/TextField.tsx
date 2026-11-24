import type { ComponentRef, Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'ref'> {
  ref?: Ref<ComponentRef<typeof TextInput>>;
  label?: string;
  error?: string;
  helper?: string;
}

export function TextField({ label, error, helper, ref, ...rest }: TextFieldProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      {label ? (
        <Text variant="footnote" color="textSecondary">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.textTertiary}
        selectionColor={theme.colors.accent}
        style={[styles.input, error ? styles.inputError : undefined]}
        {...rest}
      />
      {error ? (
        <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="footnote" color="textTertiary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.spacing.xs,
  },
  input: {
    ...theme.typography.body,
    minHeight: 52,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
}));
