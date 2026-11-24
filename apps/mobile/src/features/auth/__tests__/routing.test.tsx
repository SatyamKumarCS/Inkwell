import { act } from '@testing-library/react-native';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import type { User } from '@inkwell/shared';

import * as TabsLayout from '@/app/(app)/(tabs)/_layout';
import * as AppLayout from '@/app/(app)/_layout';
import * as AuthLayout from '@/app/(auth)/_layout';
import * as OnboardingLayout from '@/app/(onboarding)/_layout';
import * as RootLayout from '@/app/_layout';

import { useSession } from '../session';

// The real layout modules (Stack.Protected guards and unstable_settings) with placeholder screens: this
// exercises Expo Router's own redirect logic for every gate.
const stub = (name: string) =>
  function Stub() {
    return <Text>{`screen:${name}`}</Text>;
  };

const routes = {
  _layout: RootLayout,
  loading: stub('loading'),
  '(auth)/_layout': AuthLayout,
  '(auth)/sign-in': stub('sign-in'),
  '(auth)/verify': stub('verify'),
  '(onboarding)/_layout': OnboardingLayout,
  '(onboarding)/name': stub('name'),
  '(onboarding)/tour': stub('tour'),
  '(onboarding)/notifications': stub('notifications'),
  '(app)/_layout': AppLayout,
  '(app)/(tabs)/_layout': TabsLayout,
  '(app)/(tabs)/index': stub('home'),
  '(app)/(tabs)/tasks': stub('tasks'),
  '(app)/(tabs)/calendar': stub('calendar'),
  '(app)/doc/[id]': stub('doc'),
  '(app)/docs': stub('docs'),
  '(app)/task/[id]': stub('task'),
  '(app)/settings': stub('settings'),
  '(app)/dev': stub('dev'),
};

const ts = { seconds: 1, nanoseconds: 0 };
const profile = (onboarding: User['onboarding']): User => ({
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

const setSession = (state: Partial<ReturnType<typeof useSession.getState>>) =>
  act(() => useSession.setState(state));

beforeEach(() => {
  useSession.setState({
    authStatus: 'initializing',
    uid: null,
    profileStatus: 'idle',
    profile: null,
  });
});

describe('routing gate (real Expo Router)', () => {
  it('cold start signed out: shows sign-in, not an unmatched route', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen.getByText('screen:loading')).toBeOnTheScreen();

    await setSession({ authStatus: 'signedOut' });
    expect(screen.getByText('screen:sign-in')).toBeOnTheScreen();
    expect(screen).toHavePathname('/sign-in');
  });

  it('walks a new user through name, tour and Home', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    await setSession({ authStatus: 'signedIn', uid: 'ada', profileStatus: 'loading' });
    expect(screen.getByText('screen:loading')).toBeOnTheScreen();

    await setSession({ profileStatus: 'missing' });
    expect(screen.getByText('screen:name')).toBeOnTheScreen();

    await setSession({ profileStatus: 'ready', profile: profile({}) });
    expect(screen.getByText('screen:tour')).toBeOnTheScreen();

    // Notifications are skipped in Jest (iOS platform), so the tour leads straight to Home.
    await setSession({ profile: profile({ tourCompletedAt: ts }) });
    expect(screen.getByText('screen:home')).toBeOnTheScreen();
    expect(screen).toHavePathname('/');
  });

  it('cold start as a fully onboarded user lands on Home', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    await setSession({
      authStatus: 'signedIn',
      uid: 'ada',
      profileStatus: 'ready',
      profile: profile({ tourCompletedAt: ts }),
    });
    expect(screen.getByText('screen:home')).toBeOnTheScreen();
  });

  it('signed out: opens the code screen and goes back to sign-in', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    await setSession({ authStatus: 'signedOut' });

    await testRouter.push('/verify');
    expect(screen.getByText('screen:verify')).toBeOnTheScreen();
    await testRouter.back();
    expect(screen.getByText('screen:sign-in')).toBeOnTheScreen();
  });

  it('a deep link the gate does not allow lands on the gate route instead', async () => {
    await renderRouter(routes, { initialUrl: '/dev' });
    await setSession({ authStatus: 'signedOut' });
    expect(screen.getByText('screen:sign-in')).toBeOnTheScreen();
  });

  it('signing out from Home returns to sign-in', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    await setSession({
      authStatus: 'signedIn',
      uid: 'ada',
      profileStatus: 'ready',
      profile: profile({ tourCompletedAt: ts }),
    });
    await setSession({ authStatus: 'signedOut', uid: null, profileStatus: 'idle', profile: null });
    expect(screen.getByText('screen:sign-in')).toBeOnTheScreen();
  });
});
