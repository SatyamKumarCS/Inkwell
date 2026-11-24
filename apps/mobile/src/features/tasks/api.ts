import { generateKeyBetween } from 'fractional-indexing';
import { useEffect } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  Collections,
  taskListSchema,
  taskSchema,
  type Task,
  type TaskList,
} from '@inkwell/shared';

import {
  deleteDocument,
  deleteField,
  listenQuery,
  newDocId,
  orderBy,
  serverTimestamp,
  setDocument,
  updateDocument,
  where,
} from '@/lib/db';

export type TaskItem = Task & { id: string };
export type TaskListItem = TaskList & { id: string };

export type LoadStatus = 'loading' | 'ready' | 'error';

interface TasksStore {
  status: LoadStatus;
  tasks: TaskItem[];
  listsStatus: LoadStatus;
  lists: TaskListItem[];
}

const useTasksStore = create<TasksStore>(() => ({
  status: 'loading',
  tasks: [],
  listsStatus: 'loading',
  lists: [],
}));

function parse<T>(
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
  raw: { id: string; data: Record<string, unknown> }[],
): (T & { id: string })[] {
  return raw.flatMap(({ id, data }) => {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      console.warn('[tasks] skipped invalid record', id);
      return [];
    }
    return [{ ...parsed.data, id }];
  });
}

/**
 * Keeps the user's tasks and task lists in a space in memory (one listener each, ordered by `order`).
 * Mounted once in the signed-in layout; Tasks and Calendar filter in memory.
 */
export function useTasksSync(uid: string, spaceId: string): void {
  useEffect(() => {
    useTasksStore.setState({ status: 'loading', tasks: [] });
    return listenQuery(
      Collections.tasks,
      [where('ownerId', '==', uid), where('spaceId', '==', spaceId), orderBy('order')],
      (view) => useTasksStore.setState({ status: 'ready', tasks: parse(taskSchema, view.docs) }),
      (error) => {
        console.warn('[tasks] listener failed', error);
        useTasksStore.setState({ status: 'error' });
      },
    );
  }, [uid, spaceId]);

  useEffect(() => {
    useTasksStore.setState({ listsStatus: 'loading', lists: [] });
    return listenQuery(
      Collections.taskLists,
      [where('ownerId', '==', uid), where('spaceId', '==', spaceId), orderBy('order')],
      (view) =>
        useTasksStore.setState({ listsStatus: 'ready', lists: parse(taskListSchema, view.docs) }),
      (error) => {
        console.warn('[tasks] lists listener failed', error);
        useTasksStore.setState({ listsStatus: 'error' });
      },
    );
  }, [uid, spaceId]);
}

export const useTasks = () =>
  useTasksStore(useShallow((s) => ({ status: s.status, tasks: s.tasks })));
export const useTaskLists = () =>
  useTasksStore(useShallow((s) => ({ status: s.listsStatus, lists: s.lists })));
export const useTaskItem = (taskId: string): TaskItem | undefined =>
  useTasksStore((s) => s.tasks.find((t) => t.id === taskId));

/** Non-reactive check (e.g. before a deferred save, so a deleted task isn't written to). */
export const taskExists = (taskId: string): boolean =>
  useTasksStore.getState().tasks.some((t) => t.id === taskId);

const taskPath = (id: string) => `${Collections.tasks}/${id}`;
const listPath = (id: string) => `${Collections.taskLists}/${id}`;

/** An order key after every existing one, so new items go to the bottom. */
function nextOrder(items: { order: string }[]): string {
  const last = items.reduce<string | null>(
    (max, item) => (max === null || item.order > max ? item.order : max),
    null,
  );
  return generateKeyBetween(last, null);
}

export interface NewTask {
  uid: string;
  spaceId: string;
  title: string;
  listId?: string;
  /** "YYYY-MM-DD" */
  scheduledDate?: string;
}

/** Creates a task (queued offline, one write) and returns its id. */
export function createTask({ uid, spaceId, title, listId, scheduledDate }: NewTask): string {
  const id = newDocId(Collections.tasks);
  void setDocument(taskPath(id), {
    spaceId,
    ownerId: uid,
    title,
    done: false,
    order: nextOrder(useTasksStore.getState().tasks),
    ...(listId ? { listId } : {}),
    ...(scheduledDate ? { scheduledDate } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch((error: unknown) => console.warn('[tasks] create failed', error));
  return id;
}

export type TaskChanges = Partial<Pick<Task, 'title' | 'notes' | 'listId' | 'scheduledDate'>>;

/** Updates a task (one write). `null` clears an optional field. */
export function updateTask(
  taskId: string,
  changes: { [K in keyof TaskChanges]?: TaskChanges[K] | null },
): Promise<void> {
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [key, value] of Object.entries(changes)) {
    data[key] = value === null ? deleteField() : value;
  }
  return updateDocument(taskPath(taskId), data);
}

export function setTaskDone(taskId: string, done: boolean): Promise<void> {
  return updateDocument(taskPath(taskId), {
    done,
    ...(done ? { doneAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  });
}

export const deleteTask = (taskId: string) => deleteDocument(taskPath(taskId));

export function createTaskList(uid: string, spaceId: string, name: string, icon = '📋'): string {
  const id = newDocId(Collections.taskLists);
  void setDocument(listPath(id), {
    spaceId,
    ownerId: uid,
    name,
    icon,
    order: nextOrder(useTasksStore.getState().lists),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch((error: unknown) => console.warn('[tasks] create list failed', error));
  return id;
}

// Date helpers live in ./dates (pure, unit-tested); re-exported so existing imports keep working.
export { addDays, isoDate } from './dates';
