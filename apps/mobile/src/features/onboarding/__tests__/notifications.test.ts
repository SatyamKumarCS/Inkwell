import { notificationPromptSupported } from '../notifications';

describe('notificationPromptSupported', () => {
  it.each<[string, string | number, boolean]>([
    ['android', 33, true],
    ['android', 35, true],
    ['android', 32, false],
    ['ios', '18.2', false],
  ])('%s %p -> %p', (os, version, expected) => {
    expect(notificationPromptSupported(os, version)).toBe(expected);
  });
});
