import { useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { EMAIL_CODE_LENGTH } from '@inkwell/shared';

import { Text } from '@/components';

export interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}

/**
 * One transparent TextInput laid over the digit cells, so paste and one-time-code autofill work and
 * screen readers see a single field.
 */
export function OtpInput({
  value,
  onChange,
  length = EMAIL_CODE_LENGTH,
  disabled = false,
  invalid = false,
  autoFocus = true,
}: OtpInputProps) {
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <Pressable
      style={styles.row}
      onPress={() => inputRef.current?.focus()}
      accessible={false}
      disabled={disabled}
    >
      {Array.from({ length }, (_, i) => (
        <View
          key={i}
          style={[
            styles.cell,
            focused && i === activeIndex && styles.cellActive,
            invalid && styles.cellInvalid,
          ]}
          importantForAccessibility="no-hide-descendants"
        >
          <Text variant="title2">{value[i] ?? ''}</Text>
        </View>
      ))}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
        maxLength={length}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        autoFocus={autoFocus}
        editable={!disabled}
        caretHidden
        contextMenuHidden={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel="Verification code"
        accessibilityHint={`Enter the ${length}-digit code from the email`}
        style={styles.input}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  cell: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  cellActive: {
    borderColor: theme.colors.accent,
    borderWidth: 2,
  },
  cellInvalid: {
    borderColor: theme.colors.danger,
  },
  input: {
    ...StyleSheet.absoluteFillObject,
    color: 'transparent',
    backgroundColor: 'transparent',
  },
}));
