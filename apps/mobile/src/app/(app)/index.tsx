import { router } from 'expo-router';
import { FileText, LogOut, Wrench } from 'lucide-react-native';
import { Alert, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  Avatar,
  Card,
  EmptyState,
  IconButton,
  ListRow,
  OfflineBanner,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components';
import { signOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/session';
import { greeting } from '@/features/home/greeting';
import { useSpace } from '@/features/spaces/useSpace';

function confirmSignOut() {
  Alert.alert('Sign out?', 'You can sign back in with your email at any time.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
  ]);
}

/** Phase 1 Home: proves the signed-in state. Docs, sections and tabs arrive in Phase 2. */
export default function HomeScreen() {
  const profile = useSession((s) => s.profile);
  if (!profile) return null; // The root gate only shows this route once the profile is loaded.
  return (
    <Home
      firstName={profile.firstName}
      displayName={profile.displayName}
      spaceId={profile.defaultSpaceId}
    />
  );
}

function Home({
  firstName,
  displayName,
  spaceId,
}: {
  firstName: string;
  displayName: string;
  spaceId: string;
}) {
  const space = useSpace(spaceId);

  return (
    <Screen scroll>
      <View style={styles.topBar}>
        <Avatar name={displayName} size={40} />
        <IconButton icon={LogOut} accessibilityLabel="Sign out" filled onPress={confirmSignOut} />
      </View>
      <OfflineBanner />

      <Text variant="largeTitle" accessibilityRole="header">
        {greeting(new Date())}, {firstName}
      </Text>

      <SectionHeader title="Your space" />
      <Card flush>
        {space.status === 'loading' ? (
          <View style={styles.skeleton}>
            <Skeleton width="50%" height={20} />
          </View>
        ) : space.status === 'error' ? (
          <ListRow title="Couldn't load your space" subtitle="Check your connection" />
        ) : (
          <ListRow title={`${space.space.icon} ${space.space.name}`} subtitle="Only you" />
        )}
      </Card>

      <Card>
        <EmptyState
          icon={FileText}
          title="Your docs will live here"
          message="Creating and editing docs arrives in the next phase."
        />
      </Card>

      {__DEV__ ? (
        <Card flush>
          <ListRow
            title="Component gallery"
            subtitle="Developer tools"
            icon={Wrench}
            showChevron
            onPress={() => router.push('/dev')}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm,
  },
  skeleton: {
    padding: theme.spacing.lg,
  },
}));
