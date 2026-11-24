import { useRouter } from 'expo-router';
import { FileText, Settings, Sparkles, Star, Trash, Wrench } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  Avatar,
  Card,
  EmptyState,
  ListRow,
  OfflineBanner,
  Screen,
  Skeleton,
  Text,
} from '@/components';
import { useSession } from '@/features/auth/session';
import { FirestoreUsageRow } from '@/features/dev/FirestoreUsageRow';
import { seedSampleContent } from '@/features/dev/seed';
import { docTitle, useDocs, useStars } from '@/features/docs/api';
import { DocCard } from '@/features/docs/components/DocCard';
import { SearchField } from '@/features/docs/components/SearchField';
import { matchesQuery } from '@/features/docs/format';
import { greeting } from '@/features/home/greeting';
import { TAB_BAR_SPACE } from '@/features/navigation/FloatingTabBar';
import { TopBar } from '@/features/navigation/TopBar';
import { useSpace } from '@/features/spaces/useSpace';

const CARD_WIDTH = 168;
const RECENT_COUNT = 8;

export default function HomeScreen() {
  const profile = useSession((s) => s.profile);
  const uid = useSession((s) => s.uid);
  if (!profile || !uid) return null; // The root gate only shows this route once the profile is loaded.
  return (
    <Home
      uid={uid}
      firstName={profile.firstName}
      displayName={profile.displayName}
      spaceId={profile.defaultSpaceId}
    />
  );
}

function Home({
  uid,
  firstName,
  displayName,
  spaceId,
}: {
  uid: string;
  firstName: string;
  displayName: string;
  spaceId: string;
}) {
  const router = useRouter();
  const space = useSpace(spaceId);
  const docs = useDocs();
  const stars = useStars();
  const [query, setQuery] = useState('');

  const live = useMemo(() => docs.docs.filter((d) => !d.deleted), [docs.docs]);
  const matches = useMemo(
    () => live.filter((d) => matchesQuery(docTitle(d), query)),
    [live, query],
  );
  const recent = matches.slice(0, RECENT_COUNT);
  const starred = live.filter((d) => stars.has(d.id));
  const trashCount = docs.docs.length - live.length;
  const openDoc = (id: string) => router.push({ pathname: '/doc/[id]', params: { id } });
  const spaceName = space.status === 'ready' ? space.space.name : 'your space';

  return (
    <Screen scroll>
      <View style={styles.bottomSpace}>
        <TopBar
          left={<Avatar name={displayName} size={40} />}
          actions={[
            {
              icon: Settings,
              accessibilityLabel: 'Settings',
              onPress: () => router.push('/settings'),
            },
          ]}
        />
        <OfflineBanner />

        <View style={styles.titleBlock}>
          <Text variant="largeTitle" accessibilityRole="header">
            Home
          </Text>
          <Text variant="subhead" color="textSecondary">
            {greeting(new Date())}, {firstName}
          </Text>
        </View>

        <SearchField value={query} onChangeText={setQuery} placeholder={`Search in ${spaceName}`} />

        {docs.status === 'loading' ? (
          <View style={styles.carousel}>
            <Skeleton width={CARD_WIDTH} height={CARD_WIDTH / 0.78} />
            <Skeleton width={CARD_WIDTH} height={CARD_WIDTH / 0.78} />
          </View>
        ) : docs.status === 'error' && docs.docs.length === 0 ? (
          <Card>
            <EmptyState
              icon={FileText}
              title="Couldn't load your docs"
              message="Check your connection and try again."
            />
          </Card>
        ) : recent.length === 0 ? (
          <Card>
            <EmptyState
              icon={FileText}
              title={query ? 'No matching docs' : 'No docs yet'}
              message={query ? `Nothing titled "${query.trim()}".` : 'Tap + to write your first doc.'}
            />
          </Card>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
            style={styles.bleed}
          >
            {recent.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                starred={stars.has(doc.id)}
                width={CARD_WIDTH}
                onPress={() => openDoc(doc.id)}
              />
            ))}
          </ScrollView>
        )}

        <Card flush>
          <ListRow
            title="All Docs"
            subtitle={docs.status === 'ready' ? `${live.length} docs` : undefined}
            icon={FileText}
            showChevron
            onPress={() => router.push({ pathname: '/docs', params: { filter: 'all' } })}
          />
          <ListRow
            title="Starred"
            icon={Star}
            showChevron
            onPress={() => router.push({ pathname: '/docs', params: { filter: 'starred' } })}
          />
          <ListRow
            title="Trash"
            subtitle={trashCount > 0 ? `${trashCount} docs` : undefined}
            icon={Trash}
            showChevron
            onPress={() => router.push({ pathname: '/docs', params: { filter: 'trash' } })}
          />
        </Card>

        <Text variant="title2" accessibilityRole="header">
          Starred
        </Text>
        {starred.length === 0 ? (
          <Card style={styles.starHint}>
            <Text variant="callout" color="textTertiary" align="center" style={styles.italic}>
              Star docs to keep them close
            </Text>
          </Card>
        ) : (
          <Card flush>
            {starred.map((doc) => (
              <ListRow
                key={doc.id}
                title={`${doc.icon ? `${doc.icon} ` : ''}${docTitle(doc)}`}
                icon={doc.icon ? undefined : FileText}
                showChevron
                onPress={() => openDoc(doc.id)}
              />
            ))}
          </Card>
        )}

        {__DEV__ ? (
          <Card flush>
            <FirestoreUsageRow />
            <ListRow
              title="Add sample content"
              subtitle="Docs, lists and tasks for a demo"
              icon={Sparkles}
              onPress={() =>
                Alert.alert('Add sample content?', 'Adds 3 docs, 2 task lists and 6 tasks.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Add',
                    onPress: () =>
                      void seedSampleContent(uid, spaceId).catch((error: unknown) =>
                        console.warn('[dev] seed failed', error),
                      ),
                  },
                ])
              }
            />
            <ListRow
              title="Component gallery"
              subtitle="Developer tools"
              icon={Wrench}
              showChevron
              onPress={() => router.push('/dev')}
            />
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  bottomSpace: {
    gap: theme.spacing.lg,
    paddingBottom: TAB_BAR_SPACE,
  },
  titleBlock: {
    gap: theme.spacing.xxs,
    paddingTop: theme.spacing.lg,
  },
  bleed: {
    marginHorizontal: -theme.spacing.lg,
  },
  carousel: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  starHint: {
    paddingVertical: theme.spacing.xxl,
  },
  italic: {
    fontStyle: 'italic',
  },
}));
