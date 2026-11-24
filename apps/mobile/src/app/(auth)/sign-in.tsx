import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { EmailCodePolicy, emailAddressSchema } from '@inkwell/shared';

import { Button, Card, Logo, OfflineBanner, Screen, Text, TextField } from '@/components';
import { requestEmailCode } from '@/features/auth/api';
import { authFailureMessage, toAuthFailure } from '@/features/auth/errors';
import { availableSignInMethods } from '@/features/auth/methods';
import { setNameHint } from '@/features/auth/session';
import { haptics } from '@/lib/haptics';
import { useIsOffline } from '@/lib/network';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [busyMethod, setBusyMethod] = useState<string | null>(null);
  const offline = useIsOffline();
  const methods = availableSignInMethods();

  const goToVerify = (address: string, resendAfterSeconds: number) =>
    router.push({
      pathname: '/verify',
      params: { email: address, resendAfter: String(resendAfterSeconds) },
    });

  async function submit() {
    const parsed = emailAddressSchema.safeParse(email);
    if (!parsed.success) {
      setError(authFailureMessage({ reason: 'invalid-email' }));
      return;
    }
    setError(null);
    setSending(true);
    try {
      const { resendAfterSeconds } = await requestEmailCode(parsed.data);
      goToVerify(parsed.data, resendAfterSeconds);
    } catch (e) {
      const failure = toAuthFailure(e);
      const retryAfter = failure.retryAfterSeconds ?? 0;
      if (
        failure.reason === 'rate-limited' &&
        retryAfter <= EmailCodePolicy.resendCooldownSeconds
      ) {
        // A code was sent moments ago (e.g. the user came back from the code screen): reuse it.
        goToVerify(parsed.data, retryAfter);
      } else {
        haptics.error();
        setError(authFailureMessage(failure));
      }
    } finally {
      setSending(false);
    }
  }

  async function signInWith(method: (typeof methods)[number]) {
    setError(null);
    setBusyMethod(method.id);
    try {
      const { nameHint } = await method.signIn();
      setNameHint(nameHint ?? null);
    } catch (e) {
      haptics.error();
      setError(authFailureMessage(toAuthFailure(e)));
    } finally {
      setBusyMethod(null);
    }
  }

  return (
    <Screen scroll avoidKeyboard>
      <OfflineBanner message="You're offline — connect to sign in" />
      <View style={styles.hero}>
        <Logo size={64} />
        <Text variant="title1" align="center" accessibilityRole="header">
          Welcome to Inkwell
        </Text>
        <Text variant="callout" color="textSecondary" align="center">
          Enter your email and we’ll send you a 6-digit code. New here? The same code creates your
          account.
        </Text>
      </View>

      <Card style={styles.card}>
        <TextField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (error) setError(null);
          }}
          error={error ?? undefined}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={submit}
          editable={!sending}
        />
        <Button
          label="Continue"
          size="lg"
          fullWidth
          loading={sending}
          disabled={offline || busyMethod !== null}
          onPress={submit}
        />

        {methods.length > 0 ? (
          <>
            <View style={styles.divider}>
              <View style={styles.rule} />
              <Text variant="footnote" color="textTertiary">
                or
              </Text>
              <View style={styles.rule} />
            </View>
            {methods.map((method) => (
              <Button
                key={method.id}
                label={method.label}
                variant="secondary"
                size="lg"
                fullWidth
                loading={busyMethod === method.id}
                disabled={offline || sending || busyMethod !== null}
                onPress={() => signInWith(method)}
              />
            ))}
          </>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.md,
  },
  card: {
    gap: theme.spacing.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
}));
