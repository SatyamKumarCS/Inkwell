import {
  addIsoDays,
  calendarDays,
  dailyNoteTitle,
  dayLabel,
  daysBetween,
  filterTasks,
  groupByDate,
  groupByList,
  isoDate,
  listLabel,
  parseIsoDate,
  scheduleOptions,
  shortDateLabel,
  splitDone,
  tasksByDay,
  type TaskLike,
} from '../dates';

const TODAY = '2026-11-25'; // a Wednesday

const task = (id: string, rest: Partial<TaskLike> = {}): TaskLike => ({ id, done: false, ...rest });

describe('date helpers', () => {
  it('formats and parses local ISO dates', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(isoDate(parseIsoDate('2026-11-25'))).toBe('2026-11-25');
  });

  it('adds days across month and year boundaries', () => {
    expect(addIsoDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addIsoDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addIsoDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days between dates', () => {
    expect(daysBetween(TODAY, TODAY)).toBe(0);
    expect(daysBetween(TODAY, '2026-12-02')).toBe(7);
    expect(daysBetween(TODAY, '2026-11-24')).toBe(-1);
    // Spans the March DST change in many time zones.
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
  });

  it('labels days relative to today', () => {
    expect(dayLabel(TODAY, TODAY)).toEqual({ date: '25 Nov', relative: 'Today', weekday: 'Wednesday' });
    expect(dayLabel('2026-11-26', TODAY)).toEqual({
      date: '26 Nov',
      relative: 'Tomorrow',
      weekday: 'Thursday',
    });
    expect(dayLabel('2026-11-27', TODAY).relative).toBeUndefined();
    expect(dayLabel('2027-01-02', TODAY).date).toBe('2 Jan 2027');
  });

  it('builds short labels and daily note titles', () => {
    expect(shortDateLabel(TODAY, TODAY)).toBe('Today');
    expect(shortDateLabel('2026-11-24', TODAY)).toBe('Yesterday');
    expect(shortDateLabel('2026-11-28', TODAY)).toBe('Sat 28 Nov');
    expect(dailyNoteTitle(TODAY)).toBe('Wed, 25 Nov');
  });

  it('lists consecutive calendar days', () => {
    const days = calendarDays('2026-11-29', 4);
    expect(days).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
    expect(calendarDays(TODAY, 14)).toHaveLength(14);
  });

  it('offers quick schedule options', () => {
    expect(scheduleOptions(TODAY)).toEqual([
      { label: 'Today', value: TODAY },
      { label: 'Tomorrow', value: '2026-11-26' },
      { label: 'Next week', value: '2026-12-02' },
      { label: 'No date', value: null },
    ]);
  });
});

describe('filterTasks', () => {
  const tasks = [
    task('inbox'),
    task('inbox-today', { scheduledDate: TODAY }),
    task('work-past', { listId: 'work', scheduledDate: '2026-11-20' }),
    task('work-tomorrow', { listId: 'work', scheduledDate: '2026-11-26' }),
    task('later', { scheduledDate: '2026-12-10', done: true }),
  ];
  const ids = (list: TaskLike[]) => list.map((t) => t.id);

  it('inbox = tasks without a list', () => {
    expect(ids(filterTasks(tasks, 'inbox', TODAY))).toEqual(['inbox', 'inbox-today', 'later']);
  });

  it('today = scheduled today', () => {
    expect(ids(filterTasks(tasks, 'today', TODAY))).toEqual(['inbox-today']);
  });

  it('upcoming = scheduled after today', () => {
    expect(ids(filterTasks(tasks, 'upcoming', TODAY))).toEqual(['work-tomorrow', 'later']);
  });

  it('all = everything', () => {
    expect(filterTasks(tasks, 'all', TODAY)).toHaveLength(5);
  });

  it('splits open and done, keeping order', () => {
    const { open, done } = splitDone(tasks);
    expect(ids(open)).toEqual(['inbox', 'inbox-today', 'work-past', 'work-tomorrow']);
    expect(ids(done)).toEqual(['later']);
  });
});

describe('grouping', () => {
  it('groups by date, earliest first, skipping undated tasks', () => {
    const groups = groupByDate([
      task('a', { scheduledDate: '2026-12-01' }),
      task('b', { scheduledDate: '2026-11-26' }),
      task('c'),
      task('d', { scheduledDate: '2026-12-01' }),
    ]);
    expect(groups.map((g) => [g.date, g.tasks.map((t) => t.id)])).toEqual([
      ['2026-11-26', ['b']],
      ['2026-12-01', ['a', 'd']],
    ]);
  });

  it('groups by list with the Inbox first and empty lists kept', () => {
    const lists = [
      { id: 'work', name: 'Work', icon: '💼' },
      { id: 'home', name: 'Home', icon: '' },
    ];
    const groups = groupByList(
      [task('a', { listId: 'work' }), task('b'), task('c', { listId: 'gone' })],
      lists,
    );
    expect(groups.map((g) => [g.listId, g.name, g.tasks.map((t) => t.id)])).toEqual([
      [null, 'Inbox', ['b', 'c']],
      ['work', 'Work', ['a']],
      ['home', 'Home', []],
    ]);
    expect(listLabel(lists[0]!)).toBe('💼 Work');
    expect(listLabel(lists[1]!)).toBe('Home');
  });

  it('buckets tasks per calendar day with done tasks last', () => {
    const days = calendarDays(TODAY, 3);
    const byDay = tasksByDay(
      [
        task('done-today', { scheduledDate: TODAY, done: true }),
        task('today', { scheduledDate: TODAY }),
        task('outside', { scheduledDate: '2026-12-31' }),
        task('day-after', { scheduledDate: '2026-11-27' }),
      ],
      days,
    );
    expect([...byDay.keys()]).toEqual(days);
    expect(byDay.get(TODAY)?.map((t) => t.id)).toEqual(['today', 'done-today']);
    expect(byDay.get('2026-11-26')).toEqual([]);
    expect(byDay.get('2026-11-27')?.map((t) => t.id)).toEqual(['day-after']);
  });
});
