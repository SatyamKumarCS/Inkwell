import { CloudOff, TriangleAlert } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, EmptyState, Screen } from '@/components';
import { signOut } from '@/features/auth/api';
import { retryProfileLoad, useSession } from '@/features/auth/session';
import { useIsOffline } from '@/lib/network';

/** Shown behind the splash while auth starts, and while a signed-in user's profile loads. */
export default function LoadingScreen() {
  const { theme } = useUnistyles();
  const profileStatus = useSession((s) => s.profileStatus);
  const offline = useIsOffline();

  if (profileStatus === 'error') {
    return (
      <Screen>
        <View style={styles.center}>
          <EmptyState
            icon={TriangleAlert}
            title="We couldn't load your account"
            message="Check your connection and try again."
            actionLabel="Try again"
            onActionPress={retryProfileLoad}
          />
          <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />
        </View>
      </Screen>
    );
  }

  if (profileStatus === 'loading' && offline) {
    return (
      <Screen>
        <View style={styles.center}>
          <EmptyState
            icon={CloudOff}
            title="You're offline"
            message="We'll finish loading your account as soon as you're back online."
          />
          <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.center} accessibilityLabel="Loading" accessible>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
