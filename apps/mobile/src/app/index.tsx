import { Bell, FileText, Inbox, Plus, Settings, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  Avatar,
  Button,
  Card,
  EmptyState,
  IconButton,
  ListRow,
  Logo,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
  TextField,
} from '@/components';
import { getEmulatorHost, firebaseEmulatorsEnabled } from '@/lib/env';
import { checkFirestore, type BackendStatus } from '@/lib/firebase';

const statusLabel: Record<BackendStatus | 'checking', string> = {
  checking: 'Checking…',
  reachable: 'Emulator reachable',
  offline: 'Offline — start the emulators',
  error: 'Unexpected error',
};

/** Phase 0 placeholder: shows the design system and confirms the emulator wiring. Replaced by Home in Phase 1. */
export default function PlaceholderScreen() {
  const [status, setStatus] = useState<BackendStatus | 'checking'>('checking');

  const runCheck = useCallback(() => {
    setStatus('checking');
    checkFirestore().then(setStatus);
  }, []);

  useEffect(runCheck, [runCheck]);

  return (
    <Screen scroll>
      <View style={styles.topBar}>
        <Logo size={40} />
        <View style={styles.topActions}>
          <IconButton icon={Bell} accessibilityLabel="Notifications" filled />
          <IconButton icon={Settings} accessibilityLabel="Settings" filled />
        </View>
      </View>

      <View style={styles.hero}>
        <Text variant="largeTitle" accessibilityRole="header">
          Inkwell
        </Text>
        <Text variant="callout" color="textSecondary">
          Notes, docs, tasks and an assistant that knows your writing. The foundation is ready.
        </Text>
      </View>

      <SectionHeader title="Components" />
      <Card>
        <View style={styles.row}>
          <Avatar name="Ada Lovelace" />
          <View style={styles.flex}>
            <Text variant="headline">Ada Lovelace</Text>
            <Text variant="footnote" color="textSecondary">
              Personal space
            </Text>
          </View>
        </View>
        <TextField label="Title" placeholder="Untitled doc" />
        <Button label="New doc" icon={Plus} fullWidth />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button label="Secondary" variant="secondary" />
          </View>
          <View style={styles.flex}>
            <Button label="Delete" variant="destructive" />
          </View>
        </View>
        <Button label="Ghost button" variant="ghost" />
      </Card>

      <Card flush>
        <ListRow title="All docs" icon={FileText} showChevron onPress={() => undefined} />
        <ListRow
          title="Inbox"
          subtitle="3 tasks"
          icon={Inbox}
          showChevron
          onPress={() => undefined}
        />
        <ListRow title="Ask the assistant" icon={Sparkles} showChevron onPress={() => undefined} />
      </Card>

      <SectionHeader title="Loading & empty states" />
      <Card>
        <Skeleton width="60%" height={20} />
        <Skeleton />
        <Skeleton width="80%" />
      </Card>
      <Card>
        <EmptyState
          icon={FileText}
          title="No starred docs yet"
          message="Star a doc to keep it close."
        />
      </Card>

      {__DEV__ ? (
        <>
          <SectionHeader title="Developer" />
          <Card>
            <Text variant="subhead" color="textSecondary">
              {firebaseEmulatorsEnabled
                ? `Firebase emulators at ${getEmulatorHost()}`
                : 'Firebase emulators disabled'}
            </Text>
            <Text variant="headline" color={status === 'reachable' ? 'success' : 'text'}>
              {statusLabel[status]}
            </Text>
            <Button label="Check again" variant="secondary" onPress={runCheck} />
          </Card>
        </>
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
  topActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  hero: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  flex: {
    flex: 1,
  },
}));
