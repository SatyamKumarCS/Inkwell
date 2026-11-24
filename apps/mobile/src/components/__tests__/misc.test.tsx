import { render, screen } from '@testing-library/react-native';
import { FileText } from 'lucide-react-native';

import { initials } from '../Avatar';
import { EmptyState } from '../EmptyState';
import { TextField } from '../TextField';

describe('initials', () => {
  it.each([
    ['Ada Lovelace', 'AL'],
    ['ada', 'A'],
    ['  Grace  Brewster Hopper ', 'GH'],
    ['', '?'],
  ])('%p -> %p', (name: string, expected: string) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('TextField', () => {
  it('shows the error instead of the helper text', async () => {
    await render(
      <TextField label="Email" helper="We never share it" error="Enter a valid email" />,
    );
    expect(screen.getByText('Enter a valid email')).toBeOnTheScreen();
    expect(screen.queryByText('We never share it')).toBeNull();
  });
});

describe('EmptyState', () => {
  it('renders the action only when a handler is given', async () => {
    const { rerender } = await render(
      <EmptyState icon={FileText} title="Nothing here" actionLabel="Retry" />,
    );
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    await rerender(
      <EmptyState title="Nothing here" actionLabel="Retry" onActionPress={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
  });
});
