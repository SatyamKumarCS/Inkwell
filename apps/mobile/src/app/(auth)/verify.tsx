import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { EMAIL_CODE_LENGTH } from '@inkwell/shared';

import { Button, IconButton, OfflineBanner, Screen, Text } from '@/components';
import { requestEmailCode, signInWithEmailCode } from '@/features/auth/api';
import { OtpInput } from '@/features/auth/components/OtpInput';
import { authFailureMessage, toAuthFailure } from '@/features/auth/errors';
import { firebaseEmulatorsEnabled } from '@/lib/env';
import { haptics } from '@/lib/haptics';
import { useIsOffline } from '@/lib/network';

function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function VerifyScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const params = useLocalSearchParams<{ email: string; resendAfter?: string }>();
  const email = params.email ?? '';
  const offline = useIsOffline();

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(() => Number(params.resendAfter) || 0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function verify(fullCode: string) {
    setVerifying(true);
    setError(null);
    setNotice(null);
    try {
      await signInWithEmailCode(email, fullCode);
      haptics.success();
      // Stay in the verifying state: the root layout moves on as soon as Firebase reports the sign-in.
    } catch (e) {
      haptics.error();
      setCode('');
      setError(authFailureMessage(toAuthFailure(e)));
      setVerifying(false);
    }
  }

  function onChange(next: string) {
    setCode(next);
    if (error) setError(null);
    if (next.length === EMAIL_CODE_LENGTH) void verify(next);
  }

  async function resend() {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      const { resendAfterSeconds } = await requestEmailCode(email);
      setResendIn(resendAfterSeconds);
      setCode('');
      setNotice('We sent you a new code.');
    } catch (e) {
      const failure = toAuthFailure(e);
      if (failure.retryAfterSeconds) setResendIn(failure.retryAfterSeconds);
      setError(authFailureMessage(failure));
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen scroll avoidKeyboard>
      <View style={styles.topBar}>
        <IconButton
          icon={ChevronLeft}
          accessibilityLabel="Back"
          onPress={() => router.back()}
          disabled={verifying}
        />
      </View>
      <OfflineBanner />

      <View style={styles.header}>
        <Text variant="title1" align="center" accessibilityRole="header">
          Check your email
        </Text>
        <Text variant="callout" color="textSecondary" align="center">
          Enter the {EMAIL_CODE_LENGTH}-digit code we sent to
        </Text>
        <Text variant="headline" align="center">
          {email}
        </Text>
      </View>

      <OtpInput value={code} onChange={onChange} disabled={verifying} invalid={!!error} />

      <View style={styles.status} accessibilityLiveRegion="polite">
        {verifying ? (
          <ActivityIndicator color={theme.colors.accent} accessibilityLabel="Checking code" />
        ) : error ? (
          <Text variant="subhead" color="danger" align="center" accessibilityRole="alert">
            {error}
          </Text>
        ) : notice ? (
          <Text variant="subhead" color="success" align="center">
            {notice}
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text variant="subhead" color="textSecondary" align="center">
          Didn’t get it? Check your spam folder.
        </Text>
        <Button
          label={resendIn > 0 ? `Resend code in ${formatCountdown(resendIn)}` : 'Resend code'}
          variant="ghost"
          loading={resending}
          disabled={resendIn > 0 || verifying || offline}
          onPress={resend}
        />
        {__DEV__ && firebaseEmulatorsEnabled ? (
          <Text variant="footnote" color="textTertiary" align="center">
            Dev: the code is printed in the Functions emulator log.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  topBar: {
    flexDirection: 'row',
    paddingTop: theme.spacing.sm,
    marginLeft: -theme.spacing.sm,
  },
  header: {
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  status: {
    minHeight: theme.hitTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
}));
