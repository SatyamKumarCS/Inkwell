import { useRouter } from 'expo-router';
import {
  CalendarDays,
  ClipboardList,
  CloudOff,
  Inbox,
  Sunrise,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { EmptyState, OfflineBanner, Screen, Text } from '@/components';
import { useSession } from '@/features/auth/session';
import { TAB_BAR_SPACE } from '@/features/navigation/FloatingTabBar';
import { toggleTaskDone } from '@/features/tasks/actions';
import {
  createTask,
  createTaskList,
  useTaskLists,
  useTasks,
  type TaskItem,
} from '@/features/tasks/api';
import { FilterChips } from '@/features/tasks/components/FilterChips';
import { NewListInput } from '@/features/tasks/components/NewListInput';
import { NewTaskInput } from '@/features/tasks/components/NewTaskInput';
import {
  CompletedSection,
  GroupHeader,
  TaskSkeleton,
} from '@/features/tasks/components/Sections';
import { TaskRow } from '@/features/tasks/components/TaskRow';
import {
  addIsoDays,
  dayLabel,
  filterTasks,
  groupByDate,
  groupByList,
  listLabel,
  shortDateLabel,
  splitDone,
  type TaskFilter,
} from '@/features/tasks/dates';
import { useToday } from '@/features/tasks/useToday';

type NewTaskPlacement = { listId?: string; scheduledDate?: string };

export default function TasksScreen() {
  const router = useRouter();
  const uid = useSession((s) => s.uid);
  const spaceId = useSession((s) => s.profile?.defaultSpaceId);
  const today = useToday();
  const { status, tasks } = useTasks();
  const { status: listsStatus, lists } = useTaskLists();
  const [filter, setFilter] = useState<TaskFilter>('today');

  const listNames = useMemo(() => new Map(lists.map((l) => [l.id, listLabel(l)])), [lists]);
  const canWrite = Boolean(uid && spaceId);

  const add = (title: string, placement: NewTaskPlacement) => {
    if (!uid || !spaceId) return;
    createTask({ uid, spaceId, title, ...placement });
  };
  const addList = (name: string) => {
    if (!uid || !spaceId) return;
    createTaskList(uid, spaceId, name);
  };

  const subtitle = (task: TaskItem, show: { date?: boolean; list?: boolean }) => {
    const parts: string[] = [];
    if (show.list && task.listId) {
      const name = listNames.get(task.listId);
      if (name) parts.push(name);
    }
    if (show.date && task.scheduledDate) parts.push(shortDateLabel(task.scheduledDate, today));
    return parts.join(' · ') || undefined;
  };

  const row = (task: TaskItem, show: { date?: boolean; list?: boolean }) => (
    <TaskRow
      key={task.id}
      title={task.title}
      done={task.done}
      subtitle={subtitle(task, show)}
      onToggle={() => toggleTaskDone(task)}
      onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
    />
  );

  const loading = status === 'loading' || (filter === 'all' && listsStatus === 'loading');

  return (
    <Screen avoidKeyboard>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <OfflineBanner message="You're offline — changes sync when you reconnect" />
        <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
          Tasks
        </Text>
        <FilterChips value={filter} onChange={setFilter} />

        {loading ? (
          <TaskSkeleton />
        ) : status === 'error' ? (
          <EmptyState
            icon={CloudOff}
            title="Couldn't load your tasks"
            message="Check your connection and try again in a moment."
          />
        ) : filter === 'inbox' || filter === 'today' ? (
          <SimpleView
            tasks={filterTasks(tasks, filter, today)}
            filter={filter}
            row={row}
            onCreate={(title) => add(title, filter === 'today' ? { scheduledDate: today } : {})}
            canWrite={canWrite}
          />
        ) : filter === 'upcoming' ? (
          <UpcomingView
            tasks={filterTasks(tasks, 'upcoming', today)}
            today={today}
            row={row}
            onCreate={add}
            canWrite={canWrite}
          />
        ) : (
          <AllTasksView
            tasks={tasks}
            lists={lists}
            row={row}
            onCreate={add}
            onCreateList={addList}
            canWrite={canWrite}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

type RowRenderer = (task: TaskItem, show: { date?: boolean; list?: boolean }) => ReactNode;

const EMPTY: Record<'inbox' | 'today', { icon: LucideIcon; title: string; message: string }> = {
  inbox: {
    icon: Inbox,
    title: 'Inbox zero',
    message: 'Tasks without a list land here. Add one below.',
  },
  today: {
    icon: Sunrise,
    title: "You're all done for today!",
    message: 'Add a task below to plan your day.',
  },
};

function SimpleView({
  tasks,
  filter,
  row,
  onCreate,
  canWrite,
}: {
  tasks: TaskItem[];
  filter: 'inbox' | 'today';
  row: RowRenderer;
  onCreate: (title: string) => void;
  canWrite: boolean;
}) {
  const { open, done } = splitDone(tasks);
  const empty = EMPTY[filter];
  return (
    <View>
      {open.length === 0 ? (
        <EmptyState icon={empty.icon} title={empty.title} message={empty.message} />
      ) : (
        open.map((t) => row(t, filter === 'inbox' ? { date: true } : { list: true }))
      )}
      <NewTaskInput
        placeholder={filter === 'today' ? 'New task for today' : 'New task'}
        onCreate={onCreate}
        disabled={!canWrite}
      />
      <CompletedSection count={done.length}>
        {done.map((t) => row(t, { list: true, date: true }))}
      </CompletedSection>
    </View>
  );
}

function UpcomingView({
  tasks,
  today,
  row,
  onCreate,
  canWrite,
}: {
  tasks: TaskItem[];
  today: string;
  row: RowRenderer;
  onCreate: (title: string, placement: NewTaskPlacement) => void;
  canWrite: boolean;
}) {
  const { open, done } = splitDone(tasks);
  const groups = groupByDate(open);
  const tomorrow = addIsoDays(today, 1);
  return (
    <View>
      {groups.length === 0 ? (
        <>
          <EmptyState
            icon={CalendarDays}
            title="No scheduled tasks"
            message="Add dates to tasks to keep things on track."
          />
          <NewTaskInput
            placeholder="New task for tomorrow"
            onCreate={(title) => onCreate(title, { scheduledDate: tomorrow })}
            disabled={!canWrite}
          />
        </>
      ) : (
        groups.map((group) => {
          const label = dayLabel(group.date, today);
          return (
            <View key={group.date}>
              <GroupHeader
                title={`${label.date} · ${label.relative ? `${label.relative} · ` : ''}${label.weekday}`}
              />
              {group.tasks.map((t) => row(t, { list: true }))}
              <NewTaskInput
                placeholder="Add task"
                onCreate={(title) => onCreate(title, { scheduledDate: group.date })}
                disabled={!canWrite}
              />
            </View>
          );
        })
      )}
      <CompletedSection count={done.length}>
        {done.map((t) => row(t, { list: true, date: true }))}
      </CompletedSection>
    </View>
  );
}

function AllTasksView({
  tasks,
  lists,
  row,
  onCreate,
  onCreateList,
  canWrite,
}: {
  tasks: TaskItem[];
  lists: { id: string; name: string; icon: string }[];
  row: RowRenderer;
  onCreate: (title: string, placement: NewTaskPlacement) => void;
  onCreateList: (name: string) => void;
  canWrite: boolean;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const { open, done } = splitDone(tasks);
  const groups = groupByList(open, lists);

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <View>
      {tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No tasks yet"
          message="Add a task to your Inbox below, or create a list."
        />
      ) : null}
      {groups.map((group) => {
        const key = group.listId ?? 'inbox';
        const isCollapsed = collapsed.has(key);
        return (
          <View key={key}>
            <GroupHeader
              title={group.listId ? listLabel({ name: group.name, icon: group.icon ?? '' }) : 'Inbox'}
              count={group.tasks.length}
              collapsed={isCollapsed}
              onToggle={() => toggle(key)}
            />
            {isCollapsed ? null : (
              <>
                {group.tasks.map((t) => row(t, { date: true }))}
                <NewTaskInput
                  placeholder={group.listId ? `New task in ${group.name}` : 'New task'}
                  onCreate={(title) =>
                    onCreate(title, group.listId ? { listId: group.listId } : {})
                  }
                  disabled={!canWrite}
                />
              </>
            )}
          </View>
        );
      })}
      {canWrite ? <NewListInput onCreate={onCreateList} /> : null}
      <CompletedSection count={done.length}>
        {done.map((t) => row(t, { list: true, date: true }))}
      </CompletedSection>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.spacing.md,
    paddingBottom: TAB_BAR_SPACE + theme.spacing.lg,
  },
  title: {
    marginTop: theme.spacing.lg,
  },
}));
