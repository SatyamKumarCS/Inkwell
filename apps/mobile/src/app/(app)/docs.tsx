import { useLocalSearchParams, useRouter } from 'expo-router';
import { FileText, RotateCcw, Star, Trash, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  Card,
  EmptyState,
  IconButton,
  ListRow,
  OfflineBanner,
  Screen,
  Skeleton,
  Text,
} from '@/components';
import {
  deleteForever,
  docTitle,
  restoreFromTrash,
  useDocs,
  useStars,
  type DocItem,
} from '@/features/docs/api';
import { loadBlockIds } from '@/features/docs/blocks';
import { DocCard } from '@/features/docs/components/DocCard';
import { SearchField } from '@/features/docs/components/SearchField';
import { matchesQuery } from '@/features/docs/format';
import { TopBar } from '@/features/navigation/TopBar';

type Filter = 'all' | 'starred' | 'trash';

const TITLES: Record<Filter, string> = { all: 'All Docs', starred: 'Starred', trash: 'Trash' };

const EMPTY: Record<Filter, { title: string; message: string }> = {
  all: { title: 'No docs yet', message: 'Tap + on Home to write your first doc.' },
  starred: { title: 'Nothing starred', message: 'Star a doc from its menu to keep it close.' },
  trash: { title: 'Trash is empty', message: 'Docs you delete stay here until you remove them.' },
};

export default function DocsScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const filter: Filter =
    params.filter === 'starred' || params.filter === 'trash' ? params.filter : 'all';
  const router = useRouter();
  const docs = useDocs();
  const stars = useStars();
  const [query, setQuery] = useState('');

  const visible = useMemo(
    () =>
      docs.docs.filter(
        (d) =>
          (filter === 'trash' ? d.deleted : !d.deleted) &&
          (filter !== 'starred' || stars.has(d.id)) &&
          matchesQuery(docTitle(d), query),
      ),
    [docs.docs, filter, stars, query],
  );

  const openDoc = (id: string) => router.push({ pathname: '/doc/[id]', params: { id } });

  return (
    <Screen scroll>
      <TopBar back />
      <OfflineBanner />
      <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
        {TITLES[filter]}
      </Text>
      {filter !== 'trash' ? (
        <SearchField value={query} onChangeText={setQuery} placeholder="Search" />
      ) : null}

      {docs.status === 'loading' ? (
        <View style={styles.grid}>
          <View style={styles.column}>
            <Skeleton width="100%" height={200} />
          </View>
          <View style={styles.column}>
            <Skeleton width="100%" height={200} />
          </View>
        </View>
      ) : docs.status === 'error' && docs.docs.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="Couldn't load your docs"
            message="Check your connection and try again."
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={filter === 'trash' ? Trash : filter === 'starred' ? Star : FileText}
            title={query ? 'No matching docs' : EMPTY[filter].title}
            message={query ? `Nothing titled "${query.trim()}".` : EMPTY[filter].message}
          />
        </Card>
      ) : filter === 'trash' ? (
        <TrashList docs={visible} />
      ) : (
        <DocGrid docs={visible} stars={stars} onOpen={openDoc} />
      )}
    </Screen>
  );
}

/** Two columns, filled alternately (a simple masonry like the reference). */
function DocGrid({
  docs,
  stars,
  onOpen,
}: {
  docs: DocItem[];
  stars: Set<string>;
  onOpen: (id: string) => void;
}) {
  const columns = [docs.filter((_, i) => i % 2 === 0), docs.filter((_, i) => i % 2 === 1)];
  return (
    <View style={styles.grid}>
      {columns.map((column, c) => (
        <View key={c} style={[styles.column, c === 1 && styles.offset]}>
          {column.map((doc) => (
            <DocCard key={doc.id} doc={doc} starred={stars.has(doc.id)} onPress={() => onOpen(doc.id)} />
          ))}
        </View>
      ))}
    </View>
  );
}

function TrashList({ docs }: { docs: DocItem[] }) {
  const { theme } = useUnistyles();
  const confirmDelete = (doc: DocItem) =>
    Alert.alert('Delete forever?', `"${docTitle(doc)}" and its content can't be recovered.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void loadBlockIds(doc.id)
            .then((blockIds) => deleteForever(doc.id, blockIds))
            .catch((error: unknown) => {
              console.warn('[docs] delete forever failed', error);
              Alert.alert("Couldn't delete the doc", 'Check your connection and try again.');
            }),
      },
    ]);

  return (
    <Card flush>
      {docs.map((doc) => (
        <ListRow
          key={doc.id}
          title={`${doc.icon ? `${doc.icon} ` : ''}${docTitle(doc)}`}
          icon={doc.icon ? undefined : FileText}
          trailing={
            <View style={[styles.actions, { gap: theme.spacing.xs }]}>
              <IconButton
                icon={RotateCcw}
                accessibilityLabel={`Restore ${docTitle(doc)}`}
                onPress={() => void restoreFromTrash(doc.id)}
              />
              <IconButton
                icon={X}
                color="danger"
                accessibilityLabel={`Delete ${docTitle(doc)} forever`}
                onPress={() => confirmDelete(doc)}
              />
            </View>
          }
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create((theme) => ({
  title: {
    paddingTop: theme.spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  column: {
    flex: 1,
    gap: theme.spacing.md,
  },
  offset: {
    paddingTop: theme.spacing.xxl,
  },
  actions: {
    flexDirection: 'row',
  },
}));
