import { useRouter } from 'expo-router';
import { CloudOff, FilePlus, FileText } from 'lucide-react-native';
import { useMemo, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { EmptyState, OfflineBanner, Screen, Skeleton, Text } from '@/components';
import { useSession } from '@/features/auth/session';
import { createDoc, docTitle, useDocs, type DocItem } from '@/features/docs/api';
import { TAB_BAR_SPACE } from '@/features/navigation/FloatingTabBar';
import { toggleTaskDone } from '@/features/tasks/actions';
import { createTask, useTaskLists, useTasks, type TaskItem } from '@/features/tasks/api';
import { NewTaskInput } from '@/features/tasks/components/NewTaskInput';
import { TaskRow } from '@/features/tasks/components/TaskRow';
import {
  calendarDays,
  dailyNoteTitle,
  dayLabel,
  listLabel,
  tasksByDay,
} from '@/features/tasks/dates';
import { useToday } from '@/features/tasks/useToday';
import { haptics } from '@/lib/haptics';

const DAYS_SHOWN = 14;

export default function CalendarScreen() {
  const router = useRouter();
  const uid = useSession((s) => s.uid);
  const spaceId = useSession((s) => s.profile?.defaultSpaceId);
  const today = useToday();
  const { status: tasksStatus, tasks } = useTasks();
  const { lists } = useTaskLists();
  const docs = useDocs();
  const creating = useRef(new Set<string>());

  const days = useMemo(() => calendarDays(today, DAYS_SHOWN), [today]);
  const byDay = useMemo(() => tasksByDay(tasks, days), [tasks, days]);
  const listNames = useMemo(() => new Map(lists.map((l) => [l.id, listLabel(l)])), [lists]);
  const dailyNotes = useMemo(() => {
    const map = new Map<string, DocItem>();
    // Docs are newest first, so the most recently edited note wins if a day somehow has two.
    for (const doc of docs.docs) {
      if (doc.isDailyNote && !doc.deleted && doc.dailyDate && !map.has(doc.dailyDate)) {
        map.set(doc.dailyDate, doc);
      }
    }
    return map;
  }, [docs.docs]);

  const canWrite = Boolean(uid && spaceId);

  const openNote = (day: string) => {
    const existing = dailyNotes.get(day);
    if (existing) {
      router.push({ pathname: '/doc/[id]', params: { id: existing.id } });
      return;
    }
    if (!uid || !spaceId || creating.current.has(day)) return;
    // Guards against a double tap creating two notes before the docs listener sees the first one.
    creating.current.add(day);
    setTimeout(() => creating.current.delete(day), 2000);
    void haptics.selection();
    const id = createDoc({ uid, spaceId, title: dailyNoteTitle(day), dailyDate: day });
    router.push({ pathname: '/doc/[id]', params: { id, isNew: '1' } });
  };

  const loading = tasksStatus === 'loading' || docs.status === 'loading';
  const failed = tasksStatus === 'error' || docs.status === 'error';

  return (
    <Screen avoidKeyboard>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <OfflineBanner message="You're offline — changes sync when you reconnect" />
        {loading ? (
          <CalendarSkeleton />
        ) : failed ? (
          <EmptyState
            icon={CloudOff}
            title="Couldn't load your calendar"
            message="Check your connection and try again in a moment."
          />
        ) : (
          days.map((day) => (
            <DaySection
              key={day}
              day={day}
              today={today}
              note={dailyNotes.get(day)}
              tasks={byDay.get(day) ?? []}
              listNames={listNames}
              canWrite={canWrite}
              onOpenNote={() => openNote(day)}
              onOpenTask={(id) => router.push({ pathname: '/task/[id]', params: { id } })}
              onAddTask={(title) => {
                if (!uid || !spaceId) return;
                createTask({ uid, spaceId, title, scheduledDate: day });
              }}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function DaySection({
  day,
  today,
  note,
  tasks,
  listNames,
  canWrite,
  onOpenNote,
  onOpenTask,
  onAddTask,
}: {
  day: string;
  today: string;
  note: DocItem | undefined;
  tasks: TaskItem[];
  listNames: Map<string, string>;
  canWrite: boolean;
  onOpenNote: () => void;
  onOpenTask: (id: string) => void;
  onAddTask: (title: string) => void;
}) {
  const { theme } = useUnistyles();
  const label = dayLabel(day, today);
  const isToday = day === today;

  return (
    <View style={styles.day}>
      {isToday ? (
        <View style={styles.header} accessibilityRole="header">
          <Text variant="largeTitle">{label.date}</Text>
          <Text variant="title3" color="textSecondary">
            <Text variant="title3" color="accent">
              Today
            </Text>
            {` · ${label.weekday}`}
          </Text>
        </View>
      ) : (
        <View style={[styles.header, styles.headerRow]} accessibilityRole="header">
          <Text variant="title3">{label.date}</Text>
          <Text variant="title3" color="textSecondary" numberOfLines={1} style={styles.shrink}>
            {label.relative ? `${label.relative} · ` : ''}
            <Text variant="title3" color="textTertiary">
              {label.weekday}
            </Text>
          </Text>
        </View>
      )}
      <View style={styles.divider} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={note ? `Open daily note ${docTitle(note)}` : 'Create daily note'}
        disabled={!note && !canWrite}
        onPress={onOpenNote}
        style={({ pressed }) => [styles.noteRow, pressed && styles.pressed]}
      >
        {note ? (
          <FileText size={theme.iconSize.md} color={theme.colors.accent} />
        ) : (
          <FilePlus size={theme.iconSize.md} color={theme.colors.textTertiary} />
        )}
        <Text color={note ? 'text' : 'textTertiary'} numberOfLines={1} style={styles.shrink}>
          {note ? docTitle(note) : 'Daily note'}
        </Text>
      </Pressable>

      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          title={task.title}
          done={task.done}
          subtitle={task.listId ? listNames.get(task.listId) : undefined}
          onToggle={() => toggleTaskDone(task)}
          onPress={() => onOpenTask(task.id)}
        />
      ))}
      <NewTaskInput placeholder="Add task" onCreate={onAddTask} disabled={!canWrite} />
    </View>
  );
}

function CalendarSkeleton() {
  return (
    <View style={styles.skeleton} accessibilityLabel="Loading calendar">
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonDay}>
          <Skeleton width={i === 0 ? '45%' : '60%'} height={i === 0 ? 36 : 24} />
          <Skeleton width="35%" height={16} />
          <Skeleton width="75%" height={16} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: TAB_BAR_SPACE + theme.spacing.lg,
  },
  day: {
    gap: theme.spacing.xs,
  },
  header: {
    gap: theme.spacing.xxs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
  },
  shrink: {
    flexShrink: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: theme.hitTarget,
    borderRadius: theme.radii.sm,
  },
  pressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  skeleton: {
    gap: theme.spacing.xxl,
  },
  skeletonDay: {
    gap: theme.spacing.md,
  },
}));
