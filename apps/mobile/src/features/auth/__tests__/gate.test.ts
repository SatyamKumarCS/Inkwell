import type { User } from '@inkwell/shared';

import { deriveGate, type GateInput } from '../gate';

const ts = { seconds: 1, nanoseconds: 0 };
const profile = (onboarding: User['onboarding'] = {}): User => ({
  createdAt: ts,
  updatedAt: ts,
  displayName: 'Ada',
  firstName: 'Ada',
  lastName: '',
  email: 'ada@example.com',
  photoURL: null,
  defaultSpaceId: 's1',
  settings: { theme: 'system', startOfWeek: 1 },
  fcmTokens: [],
  onboarding,
});

const signedIn = (rest: Partial<GateInput>): GateInput => ({
  authStatus: 'signedIn',
  profileStatus: 'ready',
  profile: profile(),
  ...rest,
});

describe('deriveGate', () => {
  const android = { notificationPromptSupported: true };
  const ios = { notificationPromptSupported: false };

  it.each<[string, GateInput, ReturnType<typeof deriveGate>]>([
    [
      'auth still starting',
      { authStatus: 'initializing', profileStatus: 'idle', profile: null },
      'initializing',
    ],
    ['signed out', { authStatus: 'signedOut', profileStatus: 'idle', profile: null }, 'signedOut'],
    ['profile loading', signedIn({ profileStatus: 'loading', profile: null }), 'loadingProfile'],
    [
      'profile failed to load',
      signedIn({ profileStatus: 'error', profile: null }),
      'loadingProfile',
    ],
    ['new account', signedIn({ profileStatus: 'missing', profile: null }), 'needsProfile'],
    ['tour not done', signedIn({}), 'needsTour'],
    [
      'notifications not asked',
      signedIn({ profile: profile({ tourCompletedAt: ts }) }),
      'needsNotifications',
    ],
    [
      'fully onboarded',
      signedIn({ profile: profile({ tourCompletedAt: ts, notificationsPromptedAt: ts }) }),
      'ready',
    ],
  ])('%s', (_label, input, expected) => {
    expect(deriveGate(input, android)).toBe(expected);
  });

  it('skips the notification step where the prompt is not supported (iOS for now)', () => {
    expect(deriveGate(signedIn({ profile: profile({ tourCompletedAt: ts }) }), ios)).toBe('ready');
  });
});
