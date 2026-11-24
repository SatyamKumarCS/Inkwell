import { BellRing } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, Screen, Text } from '@/components';
import { useSession } from '@/features/auth/session';
import {
  hasNotificationPermission,
  requestNotificationPermission,
} from '@/features/onboarding/notifications';
import { markOnboardingStep } from '@/features/onboarding/progress';
import { haptics } from '@/lib/haptics';

/** Pre-permission explanation before the Android 13+ system prompt. Not shown on iOS until Phase 3. */
export default function NotificationsScreen() {
  const { theme } = useUnistyles();
  const uid = useSession((s) => s.uid);
  const [state, setState] = useState<'idle' | 'requesting' | 'blocked'>('idle');

  const done = () => {
    if (uid) markOnboardingStep(uid, 'notificationsPromptedAt');
  };

  // Nothing to ask if the user already allowed notifications (e.g. on a previous install).
  useEffect(() => {
    void hasNotificationPermission().then((granted) => {
      if (granted && uid) markOnboardingStep(uid, 'notificationsPromptedAt');
    });
  }, [uid]);

  async function turnOn() {
    setState('requesting');
    const result = await requestNotificationPermission();
    if (result === 'blocked') {
      setState('blocked');
      return;
    }
    if (result === 'granted') haptics.success();
    done();
  }

  const blocked = state === 'blocked';

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.body}>
        <View style={styles.illustration}>
          <BellRing size={theme.iconSize.hero} color={theme.colors.accent} />
        </View>
        <Text variant="title1" align="center" accessibilityRole="header">
          {blocked ? 'Notifications are off' : 'Never miss a reminder'}
        </Text>
        <Text variant="callout" color="textSecondary" align="center">
          {blocked
            ? 'Android is blocking notifications for Inkwell. You can turn them on in Settings at any time.'
            : 'Get reminders for your tasks and a heads-up when someone shares a doc with you. You can change this any time in Settings.'}
        </Text>
      </View>

      <View style={styles.actions}>
        {blocked ? (
          <>
            <Button
              label="Open Settings"
              size="lg"
              fullWidth
              onPress={() => void Linking.openSettings()}
            />
            <Button label="Continue" variant="ghost" fullWidth onPress={done} />
          </>
        ) : (
          <>
            <Button
              label="Turn on notifications"
              size="lg"
              fullWidth
              loading={state === 'requesting'}
              onPress={turnOn}
            />
            <Button
              label="Not now"
              variant="ghost"
              fullWidth
              disabled={state === 'requesting'}
              onPress={done}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  illustration: {
    width: 104,
    height: 104,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentSoft,
    marginBottom: theme.spacing.md,
  },
  actions: {
    gap: theme.spacing.sm,
  },
}));
