import { fireEvent, render, screen } from '@testing-library/react-native';

import CalendarScreen from '@/app/(app)/(tabs)/calendar';
import TasksScreen from '@/app/(app)/(tabs)/tasks';
import TaskDetailScreen from '@/app/(app)/task/[id]';
import { useSession } from '@/features/auth/session';
import { createDoc } from '@/features/docs/api';

import { createTask, setTaskDone, updateTask } from '../api';
import { isoDate } from '../dates';

// Screen renders are slow on a cold module cache (the first test pays for it).
jest.setTimeout(30_000);

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => true, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 't1' }),
}));

const TODAY = isoDate(new Date());
const ts = { seconds: 1, nanoseconds: 0 };
const baseTask = { spaceId: 's1', ownerId: 'ada', order: 'a0', createdAt: ts, updatedAt: ts };

const mockState = {
  status: 'ready' as 'loading' | 'ready' | 'error',
  tasks: [
    { ...baseTask, id: 't1', title: 'Buy milk', done: false, scheduledDate: TODAY },
    { ...baseTask, id: 't2', title: 'Old chore', done: true, scheduledDate: TODAY },
    { ...baseTask, id: 't3', title: 'Write report', done: false, listId: 'work' },
  ],
  lists: [{ ...baseTask, id: 'work', name: 'Work', icon: '💼' }],
};

jest.mock('../api', () => {
  const actual = jest.requireActual('../dates');
  return {
    useTasks: () => ({ status: mockState.status, tasks: mockState.tasks }),
    useTaskLists: () => ({ status: mockState.status, lists: mockState.lists }),
    useTaskItem: (id: string) => mockState.tasks.find((t) => t.id === id),
    taskExists: () => true,
    createTask: jest.fn(() => 'new-id'),
    createTaskList: jest.fn(() => 'new-list'),
    updateTask: jest.fn(() => Promise.resolve()),
    setTaskDone: jest.fn(() => Promise.resolve()),
    deleteTask: jest.fn(() => Promise.resolve()),
    isoDate: actual.isoDate,
    addDays: actual.addDays,
  };
});

jest.mock('@/features/docs/api', () => ({
  useDocs: () => ({ status: 'ready', docs: [], fromCache: false }),
  createDoc: jest.fn(() => 'doc-1'),
  docTitle: (doc: { title: string }) => doc.title || 'Untitled',
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockState.status = 'ready';
  useSession.setState({ uid: 'ada', profile: { defaultSpaceId: 's1' } as never });
});

describe('TasksScreen', () => {
  it('shows today’s tasks, toggles done and creates a task for today', async () => {
    await render(<TasksScreen />);
    expect(screen.getByText('Buy milk')).toBeOnTheScreen();
    // Done tasks sink into the collapsed Completed section.
    expect(screen.queryByText('Old chore')).toBeNull();
    expect(screen.getByText('Completed · 1')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark "Buy milk" as done' }));
    expect(setTaskDone).toHaveBeenCalledWith('t1', true);

    const input = screen.getByLabelText('New task for today');
    await fireEvent.changeText(input, '  Call mom ');
    await fireEvent(input, 'submitEditing');
    expect(createTask).toHaveBeenCalledWith({
      uid: 'ada',
      spaceId: 's1',
      title: 'Call mom',
      scheduledDate: TODAY,
    });
  });

  it('groups All Tasks by list and adds to a list', async () => {
    await render(<TasksScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'All Tasks' }));
    expect(screen.getByText('💼 Work')).toBeOnTheScreen();
    expect(screen.getByText('Write report')).toBeOnTheScreen();

    const input = screen.getByLabelText('New task in Work');
    await fireEvent.changeText(input, 'Slides');
    await fireEvent(input, 'submitEditing');
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Slides', listId: 'work' }),
    );
  });

  it('shows skeletons while loading and a message on error', async () => {
    mockState.status = 'loading';
    await render(<TasksScreen />);
    expect(screen.getByLabelText('Loading tasks')).toBeOnTheScreen();

    mockState.status = 'error';
    await render(<TasksScreen />);
    expect(screen.getByText("Couldn't load your tasks")).toBeOnTheScreen();
  });
});

describe('CalendarScreen', () => {
  it('lists days with today first and creates a daily note', async () => {
    await render(<CalendarScreen />);
    expect(screen.getByText('Today')).toBeOnTheScreen();
    expect(screen.getByText('Buy milk')).toBeOnTheScreen();

    await fireEvent.press(screen.getAllByRole('button', { name: 'Create daily note' })[0]!);
    expect(createDoc).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'ada', spaceId: 's1', dailyDate: TODAY }),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/doc/[id]',
      params: { id: 'doc-1', isNew: '1' },
    });
  });
});

describe('TaskDetailScreen', () => {
  it('edits the schedule and list', async () => {
    await render(<TaskDetailScreen />);
    expect(screen.getByDisplayValue('Buy milk')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'No date' }));
    expect(updateTask).toHaveBeenCalledWith('t1', { scheduledDate: null });

    await fireEvent.press(screen.getByRole('radio', { name: '💼 Work' }));
    expect(updateTask).toHaveBeenCalledWith('t1', { listId: 'work' });
  });

  it('saves the title on blur', async () => {
    await render(<TaskDetailScreen />);
    const title = screen.getByLabelText('Task title');
    await fireEvent.changeText(title, 'Buy oat milk');
    await fireEvent(title, 'blur');
    expect(updateTask).toHaveBeenCalledWith('t1', { title: 'Buy oat milk' });
  });
});
