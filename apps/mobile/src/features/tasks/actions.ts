import { haptics } from '@/lib/haptics';

import { setTaskDone, type TaskItem } from './api';

/** Toggles done with haptics. The write is queued offline; the listener updates the UI right away. */
export function toggleTaskDone(task: Pick<TaskItem, 'id' | 'done'>): void {
  const done = !task.done;
  void (done ? haptics.success() : haptics.selection());
  setTaskDone(task.id, done).catch((error: unknown) => console.warn('[tasks] toggle failed', error));
}
