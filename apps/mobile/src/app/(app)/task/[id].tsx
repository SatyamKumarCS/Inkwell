import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CircleX, Square, SquareCheck, Trash } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { EmptyState, IconButton, OfflineBanner, Screen, Skeleton, Text } from '@/components';
import { toggleTaskDone } from '@/features/tasks/actions';
import {
  deleteTask,
  taskExists,
  updateTask,
  useTaskItem,
  useTaskLists,
  useTasks,
  type TaskItem,
} from '@/features/tasks/api';
import { listLabel, scheduleOptions, shortDateLabel } from '@/features/tasks/dates';
import { useToday } from '@/features/tasks/useToday';
import { haptics } from '@/lib/haptics';

const logFailure = (what: string) => (error: unknown) =>
  console.warn(`[tasks] ${what} failed`, error);

export default function TaskDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status } = useTasks();
  const task = useTaskItem(id ?? '');
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/tasks'));

  return (
    <Screen scroll avoidKeyboard edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.topBar}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" filled onPress={goBack} />
        {task ? (
          <IconButton
            icon={Trash}
            color="danger"
            accessibilityLabel="Delete task"
            filled
            onPress={() => confirmDelete(task, goBack)}
          />
        ) : null}
      </View>
      <OfflineBanner message="You're offline — changes sync when you reconnect" />

      {task ? (
        // Keyed by id so the drafts reset if the route param changes.
        <TaskEditor key={task.id} task={task} />
      ) : status === 'loading' ? (
        <View style={styles.skeleton}>
          <Skeleton width="70%" height={28} />
          <Skeleton width="100%" height={80} />
          <Skeleton width="50%" height={20} />
        </View>
      ) : (
        <EmptyState
          icon={CircleX}
          title={status === 'error' ? "Couldn't load this task" : 'This task no longer exists'}
          message={
            status === 'error'
              ? 'Check your connection and try again in a moment.'
              : 'It may have been deleted.'
          }
          actionLabel="Go back"
          onActionPress={goBack}
        />
      )}
    </Screen>
  );
}

function confirmDelete(task: TaskItem, goBack: () => void) {
  Alert.alert('Delete task?', `"${task.title.trim() || 'Untitled task'}" will be deleted.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: () => {
        void haptics.impact();
        goBack();
        deleteTask(task.id).catch(logFailure('delete'));
      },
    },
  ]);
}

function TaskEditor({ task }: { task: TaskItem }) {
  const { theme } = useUnistyles();
  const today = useToday();
  const { lists } = useTaskLists();

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  // Latest drafts and last saved values, so leaving the screen mid-edit still saves (blur may not fire).
  const drafts = useRef({ title: task.title, notes: task.notes ?? '' });
  const saved = useRef({ title: task.title, notes: task.notes ?? '' });
  const taskId = task.id;

  const saveTitle = () => {
    const next = drafts.current.title.trim();
    if (!next) {
      // An empty title isn't saved; restore the last one.
      drafts.current.title = saved.current.title;
      setTitle(saved.current.title);
      return;
    }
    if (next === saved.current.title || !taskExists(taskId)) return;
    saved.current.title = next;
    updateTask(taskId, { title: next }).catch(logFailure('rename'));
  };

  const saveNotes = () => {
    const next = drafts.current.notes;
    if (next === saved.current.notes || !taskExists(taskId)) return;
    saved.current.notes = next;
    updateTask(taskId, { notes: next.trim() ? next : null }).catch(logFailure('notes'));
  };

  const flush = useRef({ saveTitle, saveNotes });
  useEffect(() => {
    flush.current = { saveTitle, saveNotes };
  });
  useEffect(
    () => () => {
      flush.current.saveTitle();
      flush.current.saveNotes();
    },
    [],
  );

  const setSchedule = (value: string | null) => {
    if ((task.scheduledDate ?? null) === value) return;
    void haptics.selection();
    updateTask(taskId, { scheduledDate: value }).catch(logFailure('schedule'));
  };

  const setList = (listId: string | null) => {
    if ((task.listId ?? null) === listId) return;
    void haptics.selection();
    updateTask(taskId, { listId }).catch(logFailure('move'));
  };

  const options = scheduleOptions(today);
  const CheckIcon = task.done ? SquareCheck : Square;
  const scheduleLabel = task.scheduledDate ? shortDateLabel(task.scheduledDate, today) : 'No date';

  return (
    <View style={styles.editor}>
      <View style={styles.titleRow}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={task.done ? 'Mark as not done' : 'Mark as done'}
          accessibilityState={{ checked: task.done }}
          hitSlop={theme.spacing.md}
          onPress={() => toggleTaskDone(task)}
          style={styles.checkbox}
        >
          <CheckIcon
            size={theme.iconSize.xl}
            color={task.done ? theme.colors.accent : theme.colors.textSecondary}
            strokeWidth={task.done ? 2.2 : 1.8}
          />
        </Pressable>
        <TextInput
          value={title}
          onChangeText={(text) => {
            drafts.current.title = text;
            setTitle(text);
          }}
          onBlur={saveTitle}
          onSubmitEditing={saveTitle}
          submitBehavior="blurAndSubmit"
          multiline
          maxLength={1000}
          placeholder="Task title"
          placeholderTextColor={theme.colors.textTertiary}
          selectionColor={theme.colors.accent}
          accessibilityLabel="Task title"
          style={[styles.titleInput, task.done && styles.titleDone]}
        />
      </View>

      <TextInput
        value={notes}
        onChangeText={(text) => {
          drafts.current.notes = text;
          setNotes(text);
        }}
        onBlur={saveNotes}
        multiline
        placeholder="Add notes"
        placeholderTextColor={theme.colors.textTertiary}
        selectionColor={theme.colors.accent}
        accessibilityLabel="Notes"
        textAlignVertical="top"
        style={styles.notesInput}
      />

      <View style={styles.section}>
        <Text variant="footnote" color="textSecondary">
          Schedule · {scheduleLabel}
        </Text>
        <View style={styles.chips}>
          {options.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={(task.scheduledDate ?? null) === option.value}
              onPress={() => setSchedule(option.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="footnote" color="textSecondary">
          List
        </Text>
        <View style={styles.chips}>
          <Chip label="Inbox" selected={!task.listId} onPress={() => setList(null)} />
          {lists.map((list) => (
            <Chip
              key={list.id}
              label={listLabel(list)}
              selected={task.listId === list.id}
              onPress={() => setList(list.id)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text variant="subhead" color={selected ? 'accent' : 'text'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
  },
  skeleton: {
    gap: theme.spacing.lg,
  },
  editor: {
    gap: theme.spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  checkbox: {
    paddingTop: theme.spacing.xxs,
  },
  titleInput: {
    ...theme.typography.title2,
    flex: 1,
    color: theme.colors.text,
    padding: 0,
  },
  titleDone: {
    color: theme.colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  notesInput: {
    ...theme.typography.body,
    minHeight: 120,
    color: theme.colors.text,
    padding: theme.spacing.lg,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  section: {
    gap: theme.spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    minHeight: theme.hitTarget - theme.spacing.xs,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceMuted,
  },
  chipSelected: {
    backgroundColor: theme.colors.accentSoft,
  },
  pressed: {
    opacity: 0.7,
  },
}));
