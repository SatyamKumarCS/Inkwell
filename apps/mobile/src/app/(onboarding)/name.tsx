import { useRef, useState, type ComponentRef } from 'react';
import { TextInput, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { NAME_MAX_LENGTH } from '@inkwell/shared';

import { Button, OfflineBanner, Screen, Text, TextField } from '@/components';
import { completeProfile } from '@/features/auth/api';
import { authFailureMessage, toAuthFailure } from '@/features/auth/errors';
import { useSession } from '@/features/auth/session';
import { haptics } from '@/lib/haptics';
import { useIsOffline } from '@/lib/network';

export default function NameScreen() {
  const nameHint = useSession((s) => s.nameHint);
  const [firstName, setFirstName] = useState(nameHint?.firstName ?? '');
  const [lastName, setLastName] = useState(nameHint?.lastName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastNameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const offline = useIsOffline();
  const canSubmit = firstName.trim().length > 0 && !saving && !offline;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await completeProfile({ firstName, lastName });
      // Keep the spinner: the profile listener picks up the new doc and the tour appears.
    } catch (e) {
      haptics.error();
      setError(authFailureMessage(toAuthFailure(e)));
      setSaving(false);
    }
  }

  return (
    <Screen scroll avoidKeyboard>
      <OfflineBanner message="You're offline — connect to finish setting up" />
      <View style={styles.header}>
        <Text variant="title1" align="center" accessibilityRole="header">
          What’s your name?
        </Text>
        <Text variant="callout" color="textSecondary" align="center">
          This is how you’ll appear to people you share docs with.
        </Text>
      </View>

      <View style={styles.fields}>
        <TextField
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          autoFocus
          autoComplete="given-name"
          textContentType="givenName"
          autoCapitalize="words"
          maxLength={NAME_MAX_LENGTH}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => lastNameRef.current?.focus()}
          editable={!saving}
        />
        <TextField
          ref={lastNameRef}
          label="Last name (optional)"
          value={lastName}
          onChangeText={setLastName}
          autoComplete="family-name"
          textContentType="familyName"
          autoCapitalize="words"
          maxLength={NAME_MAX_LENGTH}
          returnKeyType="done"
          onSubmitEditing={submit}
          editable={!saving}
          error={error ?? undefined}
        />
      </View>

      <Button
        label="Continue"
        size="lg"
        fullWidth
        loading={saving}
        disabled={!canSubmit}
        onPress={submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xxxl,
  },
  fields: {
    gap: theme.spacing.md,
  },
}));
