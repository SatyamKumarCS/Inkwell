/**
 * Pure date and grouping helpers for Tasks and Calendar (no Firebase imports, so they're unit-testable).
 * Dates are local "YYYY-MM-DD" strings, matching `scheduledDate` / `dailyDate`.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Local date as "YYYY-MM-DD" (not UTC, so "today" matches the user's calendar). */
export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** "YYYY-MM-DD" → local midnight. */
export function parseIsoDate(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const addIsoDays = (iso: string, days: number): string =>
  isoDate(addDays(parseIsoDate(iso), days));

/** Whole days from `fromIso` to `toIso` (DST-safe). */
export function daysBetween(fromIso: string, toIso: string): number {
  const toUtc = (iso: string) => {
    const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / 86_400_000);
}

export interface DayLabel {
  /** "25 Nov" (with the year when it isn't this year). */
  date: string;
  /** "Today" / "Tomorrow" / "Yesterday", when applicable. */
  relative?: string;
  /** "Wednesday" */
  weekday: string;
}

function relativeName(iso: string, todayIso: string): string | undefined {
  const diff = daysBetween(todayIso, iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return undefined;
}

export function dayLabel(iso: string, todayIso: string): DayLabel {
  const date = parseIsoDate(iso);
  const sameYear = date.getFullYear() === parseIsoDate(todayIso).getFullYear();
  return {
    date: `${date.getDate()} ${MONTHS[date.getMonth()]}${sameYear ? '' : ` ${date.getFullYear()}`}`,
    relative: relativeName(iso, todayIso),
    weekday: WEEKDAYS[date.getDay()] ?? '',
  };
}

/** Short label for a task's date: "Today", "Tomorrow", "Yesterday" or "Wed 26 Nov". */
export function shortDateLabel(iso: string, todayIso: string): string {
  const label = dayLabel(iso, todayIso);
  return label.relative ?? `${label.weekday.slice(0, 3)} ${label.date}`;
}

/** Title for a new daily note: "Wed, 25 Nov". */
export function dailyNoteTitle(iso: string): string {
  const date = parseIsoDate(iso);
  return `${(WEEKDAYS[date.getDay()] ?? '').slice(0, 3)}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** `count` consecutive days starting at `startIso`. */
export function calendarDays(startIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addIsoDays(startIso, i));
}

export interface ScheduleOption {
  label: string;
  /** null = no date */
  value: string | null;
}

/** Quick schedule choices for the task detail (no date picker dependency). */
export function scheduleOptions(todayIso: string): ScheduleOption[] {
  return [
    { label: 'Today', value: todayIso },
    { label: 'Tomorrow', value: addIsoDays(todayIso, 1) },
    { label: 'Next week', value: addIsoDays(todayIso, 7) },
    { label: 'No date', value: null },
  ];
}

// --- Filtering and grouping ----------------------------------------------------------------------------

export interface TaskLike {
  id: string;
  listId?: string;
  scheduledDate?: string;
  done: boolean;
}

export interface ListLike {
  id: string;
  name: string;
  icon: string;
}

export type TaskFilter = 'inbox' | 'today' | 'upcoming' | 'all';

/** Tasks shown under a filter chip (open and done; split them with `splitDone`). */
export function filterTasks<T extends TaskLike>(
  tasks: T[],
  filter: TaskFilter,
  todayIso: string,
): T[] {
  switch (filter) {
    case 'inbox':
      return tasks.filter((t) => !t.listId);
    case 'today':
      return tasks.filter((t) => t.scheduledDate === todayIso);
    case 'upcoming':
      return tasks.filter((t) => t.scheduledDate !== undefined && t.scheduledDate > todayIso);
    case 'all':
      return tasks;
  }
}

export function splitDone<T extends TaskLike>(tasks: T[]): { open: T[]; done: T[] } {
  const open: T[] = [];
  const done: T[] = [];
  for (const task of tasks) (task.done ? done : open).push(task);
  return { open, done };
}

export interface DateGroup<T> {
  date: string;
  tasks: T[];
}

/** Groups scheduled tasks by date, earliest first (keeps the input order within a day). */
export function groupByDate<T extends TaskLike>(tasks: T[]): DateGroup<T>[] {
  const byDate = new Map<string, T[]>();
  for (const task of tasks) {
    if (!task.scheduledDate) continue;
    const group = byDate.get(task.scheduledDate);
    if (group) group.push(task);
    else byDate.set(task.scheduledDate, [task]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, group]) => ({ date, tasks: group }));
}

export interface ListGroup<T> {
  /** null = Inbox */
  listId: string | null;
  name: string;
  icon: string | null;
  tasks: T[];
}

/**
 * Inbox first, then every list in the given order (empty lists included so tasks can be added to them).
 * Tasks pointing at a list that no longer exists fall back to the Inbox.
 */
export function groupByList<T extends TaskLike>(tasks: T[], lists: ListLike[]): ListGroup<T>[] {
  const inbox: ListGroup<T> = { listId: null, name: 'Inbox', icon: null, tasks: [] };
  const groups = lists.map<ListGroup<T>>((l) => ({
    listId: l.id,
    name: l.name,
    icon: l.icon,
    tasks: [],
  }));
  const byId = new Map(groups.map((g) => [g.listId, g]));
  for (const task of tasks) {
    const group = (task.listId && byId.get(task.listId)) || inbox;
    group.tasks.push(task);
  }
  return [inbox, ...groups];
}

/** Tasks scheduled on each day, open first then done (input order kept within each). */
export function tasksByDay<T extends TaskLike>(tasks: T[], days: string[]): Map<string, T[]> {
  const wanted = new Set(days);
  const result = new Map<string, T[]>(days.map((d) => [d, []]));
  for (const task of tasks) {
    if (task.scheduledDate && wanted.has(task.scheduledDate)) {
      result.get(task.scheduledDate)?.push(task);
    }
  }
  for (const [day, list] of result) {
    const { open, done } = splitDone(list);
    result.set(day, [...open, ...done]);
  }
  return result;
}

/** "📋 Work", or just the name when there's no icon. */
export const listLabel = (list: Pick<ListLike, 'name' | 'icon'>) =>
  list.icon ? `${list.icon} ${list.name}` : list.name;
