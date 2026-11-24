import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ellipsis, FileText, Star } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, Card, EmptyState, OfflineBanner, Screen, Skeleton, Text } from '@/components';
import { useSession } from '@/features/auth/session';
import {
  moveToTrash,
  restoreFromTrash,
  setStarred,
  useDocItem,
  useDocs,
  useStars,
} from '@/features/docs/api';
import { listNumber, type EditorBlockType } from '@/features/docs/blocks';
import { BlockRow } from '@/features/docs/components/BlockRow';
import { BlockToolbar } from '@/features/docs/components/BlockToolbar';
import { useBlockEditor } from '@/features/docs/useBlockEditor';
import { TopBar } from '@/features/navigation/TopBar';
import { haptics } from '@/lib/haptics';

const DOUBLE_ENTER_MS = 300;

export default function DocScreen() {
  const { id, isNew } = useLocalSearchParams<{ id: string; isNew?: string }>();
  const uid = useSession((s) => s.uid);
  const docsStatus = useDocs().status;
  const doc = useDocItem(id);
  const router = useRouter();

  if (!uid) return null;
  if (!doc) {
    return (
      <Screen>
        <TopBar back />
        {docsStatus === 'loading' || isNew === '1' ? (
          <View style={styles.loading}>
            <Skeleton width="70%" height={34} />
            <Skeleton width="100%" height={18} />
            <Skeleton width="90%" height={18} />
          </View>
        ) : (
          <Card>
            <EmptyState
              icon={FileText}
              title={docsStatus === 'error' ? "Couldn't load this doc" : 'Doc not found'}
              message={
                docsStatus === 'error'
                  ? 'Check your connection and try again.'
                  : 'It may have been deleted for good.'
              }
              actionLabel="Go back"
              onActionPress={() => router.back()}
            />
          </Card>
        )}
      </Screen>
    );
  }
  return (
    <Editor
      key={id}
      docId={id}
      uid={uid}
      title={doc.title}
      deleted={doc.deleted}
      autoFocusTitle={isNew === '1'}
    />
  );
}

function Editor({
  docId,
  uid,
  title: savedTitle,
  deleted,
  autoFocusTitle,
}: {
  docId: string;
  uid: string;
  title: string;
  deleted: boolean;
  autoFocusTitle: boolean;
}) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const editor = useBlockEditor(docId, uid);
  const stars = useStars();
  const starred = stars.has(docId);
  const [title, setTitle] = useState(savedTitle);
  const [focused, setFocused] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<string | null>(null);
  const inputs = useRef(new Map<string, ComponentRef<typeof TextInput>>());
  const cursors = useRef(new Map<string, number>());
  const lastEnter = useRef<{ id: string; at: number } | null>(null);

  // Move the cursor to a block after it is created or its neighbour is removed.
  useEffect(() => {
    if (!focusRequest) return;
    const input = inputs.current.get(focusRequest);
    if (input) {
      input.focus();
      // Keep the cursor after the text (e.g. after a shortcut turned "[] Buy" into a to-do "Buy").
      const length = editor.blocks.find((b) => b.id === focusRequest)?.text.length ?? 0;
      input.setSelection(length, length);
      setFocusRequest(null);
    }
  }, [focusRequest, editor.blocks]);

  const focusBlock = (id: string | null) => {
    if (id) setFocusRequest(id);
  };

  const toggleStar = () => {
    void haptics.selection();
    setStarred(uid, docId, !starred).catch((error: unknown) =>
      console.warn('[editor] star failed', error),
    );
  };

  const openMenu = () =>
    Alert.alert(title.trim() || 'Untitled', undefined, [
      { text: starred ? 'Unstar' : 'Star', onPress: toggleStar },
      {
        text: 'Move to Trash',
        style: 'destructive',
        onPress: () => {
          editor.flush();
          void moveToTrash(docId);
          router.back();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const focusedBlock = editor.blocks.find((b) => b.id === focused);

  const selectType = (type: EditorBlockType) => {
    if (!focusedBlock) return;
    if (type === 'divider') {
      // Insert a divider below and keep typing after it.
      const divider = editor.insertAfter(focusedBlock.id, 'divider');
      focusBlock(editor.insertAfter(divider, 'paragraph'));
      return;
    }
    editor.setType(focusedBlock.id, type);
  };

  /** Tapping below the last block continues the doc. */
  const continueAtEnd = () => {
    const last = editor.blocks[editor.blocks.length - 1];
    if (last && last.type !== 'divider' && last.text === '') focusBlock(last.id);
    else focusBlock(editor.insertAfter(last?.id ?? null, 'paragraph'));
  };

  return (
    <Screen avoidKeyboard>
      <TopBar
        back
        actions={[
          {
            icon: Star,
            accessibilityLabel: starred ? 'Unstar doc' : 'Star doc',
            onPress: toggleStar,
            active: starred,
          },
          { icon: Ellipsis, accessibilityLabel: 'Doc options', onPress: openMenu },
        ]}
      />
      <OfflineBanner />
      {deleted ? (
        <Card style={styles.trashNotice}>
          <Text variant="subhead" color="textSecondary" style={styles.flex}>
            This doc is in the Trash.
          </Text>
          <Button label="Restore" variant="secondary" onPress={() => void restoreFromTrash(docId)} />
        </Card>
      ) : null}

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.paper}>
          <TextInput
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              editor.setTitle(text);
            }}
            autoFocus={autoFocusTitle}
            editable={!deleted}
            placeholder="Untitled"
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            scrollEnabled={false}
            submitBehavior="submit"
            onSubmitEditing={() => focusBlock(editor.blocks[0]?.id ?? null)}
            style={styles.title}
            accessibilityLabel="Title"
          />
          <View style={styles.rule} />

          {editor.status === 'loading' ? (
            <View style={styles.loading}>
              <Skeleton width="100%" height={18} />
              <Skeleton width="80%" height={18} />
            </View>
          ) : editor.status === 'error' ? (
            <Text color="danger">{"Couldn't load this doc's content. Check your connection."}</Text>
          ) : (
            editor.blocks.map((block, index) => (
              <BlockRow
                key={block.id}
                block={block}
                number={listNumber(editor.blocks, index)}
                editable={!deleted}
                inputRef={(input) => {
                  if (input) inputs.current.set(block.id, input);
                  else inputs.current.delete(block.id);
                }}
                onChangeText={(text) => focusBlock(editor.changeText(block.id, text))}
                onEnter={() => {
                  // Android can deliver one hardware Enter as two submit events.
                  const now = Date.now();
                  const last = lastEnter.current;
                  if (last && last.id === block.id && now - last.at < DOUBLE_ENTER_MS) return;
                  lastEnter.current = { id: block.id, at: now };
                  focusBlock(editor.enter(block.id, cursors.current.get(block.id) ?? block.text.length));
                }}
                onSelectionChange={(cursor) => cursors.current.set(block.id, cursor)}
                onToggle={() => {
                  void haptics.success();
                  editor.toggleChecked(block.id);
                }}
                onBackspaceEmpty={() => focusBlock(editor.remove(block.id))}
                onFocus={() => {
                  setFocused(block.id);
                  editor.setFocused(block.id);
                }}
                onBlur={() => editor.setFocused(null)}
              />
            ))
          )}
          {!deleted && editor.status === 'ready' ? (
            <Pressable
              accessibilityLabel="Continue writing"
              onPress={continueAtEnd}
              style={styles.tail}
            />
          ) : null}
        </View>
      </ScrollView>

      {focusedBlock && !deleted ? (
        <BlockToolbar current={focusedBlock.type} onSelect={selectType} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: {
    flex: 1,
  },
  scroll: {
    paddingBottom: theme.spacing.xxxl,
  },
  paper: {
    borderRadius: theme.radii.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    gap: theme.spacing.xs,
    minHeight: 480,
  },
  title: {
    ...theme.typography.title1,
    color: theme.colors.text,
    padding: 0,
  },
  rule: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  tail: {
    flexGrow: 1,
    minHeight: 160,
  },
  loading: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  trashNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
}));
